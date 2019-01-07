from flask import request, current_app
from io import BytesIO
import boto3, zipfile

import db

access_key = ""
access_secret = ""

with open("/secrets/default/spaces-creds/access_key", "r") as f:
    access_key = f.read()
with open("/secrets/default/spaces-creds/access_secret", "r") as f:
    access_secret = f.read()


def main():
    key = request.args.get("key")
    comparison = (
        db.session.query(db.Comparison).filter(db.Comparison.key == key).first()
    )
    if comparison is None:
        return "Invalid Comparison", 400

    s3 = boto3.session.Session().resource(
        "s3",
        region_name="sfo2",
        endpoint_url="https://sfo2.digitaloceanspaces.com",
        aws_access_key_id=access_key,
        aws_secret_access_key=access_secret,
    )

    zdata = BytesIO()
    zf = zipfile.ZipFile(zdata, mode="w")
    for ci in comparison.comparison_images:
        d = s3.Object("diff-pics", "images/" + ci.image.path).get()
        zf.writestr(ci.name + "." + ci.image.format, d["Body"].read())
    zf.close()

    return zdata.getvalue()
