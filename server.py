# -*- coding: utf-8 -*-

import hashlib
import json
import os
import random
import string

import boto
import raven
from boto.dynamodb2.exceptions import ItemNotFound
from boto.dynamodb2.table import Table
from boto.s3.key import Key
from raven.contrib.bottle import Sentry
from raven.utils import stacks
from raven.utils.compat import _urlparse

from bottle import app as app_factory
from bottle import (TEMPLATE_PATH, abort, error, get, post, redirect, request,
                    response, run, static_file, view)


# Monkey patch to fix what sentry sees as the URL
def uwsgi_url_fix(route):
    def _uwsgi_url_fix(*args, **kwargs):
        url = _urlparse.urlsplit(request.url)
        path = url.path.split("/")
        if url.hostname == path[0]:
            path.pop(0)
        url = list(url)
        url[2] = "/".join(path)
        request.url = _urlparse.urlunsplit(url)
        return route(*args, **kwargs)
    return _uwsgi_url_fix

# Monkey patch to get better error names in sentry
def _label_from_frame(frame):
    return frame.get('context_line', '').strip()
stacks.label_from_frame = _label_from_frame

# Initialize app
with open("config.json", "r") as f:
    CONFIG = json.load(f)

app = app_factory()
app.catchall = False
app.install(uwsgi_url_fix)
TEMPLATE_PATH.append(".")

sentry_client = raven.Client(dsn=CONFIG["sentry_dsn"],
    include_paths=[__name__.split('.', 1)[0]],
    release=raven.fetch_git_sha(os.path.dirname(__file__)))
app = Sentry(app, sentry_client)

# Initialize AWS
comparisons = Table("diff.pics-comparisons")
images = Table("diff.pics-images")
image_data = boto.connect_s3().get_bucket("diff.pics")

# Utility functions
def increment_item(item, key, value):
    item.table._update_item(item.get_keys(), {
        key: {
            "Action": "ADD",
            "Value": {"N": str(value)}
        }
    })

# Web app
@get("/static/<filename:path>")
def static(filename):
    return static_file(filename, root="{}/static".format(os.getcwd()))

@get("/")
def index():
    return static_file("index.html", root=os.getcwd())

@get("/list")
@view("list")
def list_comparisons():
    if request.params.key not in CONFIG["list_keys"]:
        abort(401)
    comps = sorted(list(comparisons.scan()), key=lambda c: int(c["views"] or 0), reverse=True)
    return {
        "comparisons": comps,
        "amount": "{:,d}".format(len(comps)),
        "total_views": "{:,d}".format(sum([int(c["views"] or 0) for c in comps]))
    }

@get("/_error")
def raise_error():
    if request.params.key not in CONFIG["list_keys"]:
        abort(401)
    raise Exception("This is a test exception for sentry")

@get("/check/<hashes>")
def check(hashes):
    hashes = set(hashes.upper().split(","))
    results = images.batch_get(keys=[{"sha1": h} for h in hashes], consistent=True)
    exists = set([r["sha1"] for r in results])
    return json.dumps({h:h in exists for h in hashes})

@post("/upload")
def upload():
    mimes = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg"
    }

    image = request.files.get("image")
    filename = request.params.get("filename")
    name, ext = os.path.splitext(filename)
    if ext not in mimes:
        return 'File extension not allowed.'

    data = image.file.read()
    sha = hashlib.sha1(data).hexdigest().upper()

    try:
        r = images.get_item(sha1=sha, consistent=True)
    except ItemNotFound:
        pass
    else:
        return "{} = {}{}".format(r.filename, r.sha1, r.ext or "")

    k = Key(image_data, sha+ext)
    k.content_type = mimes[ext]
    k.set_contents_from_string(data)

    images.put_item(data={"sha1": sha, "filename": filename, "ext": ext})

    return "{} = {}{}".format(filename, sha, ext)

@post("/submit")
def submit():
    title = request.params.get("title")
    data = json.loads(request.params.get("comparisons"))
    hashes = set([item for sublist in data for item in sublist])
    results = images.batch_get(keys=[{"sha1": h} for h in hashes], consistent=True)
    exists = set([r["sha1"] for r in results])
    if not all([h in exists for h in hashes]):
        return "Not all images exist"

    key, key_length = None, 12
    while not key:
        key = ''.join(random.choice(string.ascii_letters + string.digits) for _ in range(key_length))
        try:
            comparisons.get_item(key=key, consistent=True)
        except ItemNotFound:
            break
        key, key_length = None, key_length + 1

    comparisons.put_item(data={"key": key, "title": title, "comparisons": data, "views": 0})
    return key

@get("/<key>")
@get("/<key>/<index>")
@view("comparison")
def comparison(key, index=None):
    # We ignore index here anyway, /static/view.js is what handles it
    try:
        c = comparisons.get_item(key=key, consistent=True)
    except ItemNotFound:
        redirect("/")

    increment_item(c, "views", 1)

    hashes = set([item for sublist in c["comparisons"] for item in sublist])
    results = images.batch_get(keys=[{"sha1": h} for h in hashes], consistent=True)
    imgs = {i["sha1"]:{"hash": i["sha1"]+i.get("ext", ""), "name": i["filename"]} for i in results}
    data = [[imgs[h] for h in l] for l in c["comparisons"]]

    try:
        index = int(index)
    except ValueError:
        index = 0
    except TypeError:
        index = 0
    if index <= 0:
        index = 1
    elif index > len(data):
        index = len(data)

    return {
        "title": c["title"] or "Untitled",
        "image": "http://cdn.diff.pics/{}".format(data[index-1][0]["hash"]),
        "url": "http://diff.pics/{}/{:d}".format(key, index),
        "comparisons": json.dumps(data)
    }

@error(404)
def error404(error):
    response.status = 303
    response.set_header("Location", "/")
    return ""

if __name__ == "__main__":
    run(app=app, host="0.0.0.0", port=os.environ.get("PORT", 8080), debug=True, reloader=True)
