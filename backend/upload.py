from flask import request, current_app
from PIL import Image
from io import BytesIO
import hashlib, boto3, json

import db

access_key = ""
access_secret = ""

with open("/secrets/default/spaces-creds/access_key", "r") as f:
    access_key = f.read()
with open("/secrets/default/spaces-creds/access_secret", "r") as f:
    access_secret = f.read()


def main():
    f = request.files.get("file")
    imagedata = BytesIO()
    thumbdata = BytesIO()
    fmt = None
    with Image.open(f) as image:
        if not image.format in ("bmp", "jpeg", "png"):
            return json.dumps({"error": "invalid image format"}), 400
        thumb = image.copy()
        thumb.thumbnail((300, 60), Image.LANCZOS)
        thumb.format = image.format
        image.save(imagedata)
        thumb.save(thumbdata)
        fmt = image.format.replace("e", "")

    imagepath = hashlib.sha1(imagedata.getvalue()).hexdigest().upper()
    thumbpath = hashlib.sha1(thumbdata.getvalue()).hexdigest().upper()
    imagepath = imagepath[0:2] + "/" + imagepath[2:4] + "/" + imagepath[4:]
    thumbpath = thumbpath[0:2] + "/" + thumbpath[2:4] + "/" + thumbpath[4:]

    s3 = boto3.session.Session().resource(
        "s3",
        region_name="sfo2",
        endpoint_url="https://sfo2.digitaloceanspaces.com",
        aws_access_key_id=access_key,
        aws_secret_access_key=access_secret,
    )
    s3.Object("diff-pics", "images/" + imagepath).put(Body=imagedata, ACL="public-read")
    s3.Object("diff-pics", "thumbs/" + thumbpath).put(Body=thumbdata, ACL="public-read")

    db.session.add(db.Image(path=imagepath, thumb=thumbpath, format=fmt))
    db.session.commit()

    return ""

