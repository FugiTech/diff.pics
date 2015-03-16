# -*- coding: utf-8 -*-

import hashlib
import json
import os
import random
import string

import boto
from boto.dynamodb2.exceptions import ItemNotFound
from boto.dynamodb2.table import Table
from boto.s3.key import Key

from bottle import app as app_factory
from bottle import (TEMPLATE_PATH, error, get, post, redirect, request,
                    response, run, static_file, view)

# Initialize app
app = app_factory()
TEMPLATE_PATH.append(".")

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
    name, ext = os.path.splitext(image.raw_filename)
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

    images.put_item(data={"sha1": sha, "filename": image.raw_filename, "ext": ext})

    return "{} = {}{}".format(image.raw_filename, sha, ext)

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
@view("comparison")
def comparison(key):
    try:
        c = comparisons.get_item(key=key, consistent=True)
    except ItemNotFound:
        redirect("/")

    increment_item(c, "views", 1)

    hashes = set([item for sublist in c["comparisons"] for item in sublist])
    results = images.batch_get(keys=[{"sha1": h} for h in hashes], consistent=True)
    imgs = {i["sha1"]:{"hash": i["sha1"]+i.get("ext", ""), "name": i["filename"]} for i in results}
    data = [[imgs[h] for h in l] for l in c["comparisons"]]

    return {"title": c["title"] or "Untitled", "comparisons": json.dumps(data)}

@error(404)
def error404(error):
    response.status = 303
    response.set_header("Location", "/")
    return ""

if __name__ == "__main__":
    run(host="0.0.0.0", port=8080, debug=True)
