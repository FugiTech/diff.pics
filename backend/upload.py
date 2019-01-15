from PIL import Image
from io import BytesIO
import hashlib, boto3, json, bottle

import db

access_key = ""
access_secret = ""

with open("/spaces-creds/access_key", "r") as f:
    access_key = f.read()
with open("/spaces-creds/access_secret", "r") as f:
    access_secret = f.read()


def handler(event, context):
    f = event["extensions"]["request"].files.file.file
    imagedata = BytesIO(f.read())
    thumbdata = BytesIO()
    fmt = None

    with Image.open(imagedata) as image:
        fmt = image.format.lower().replace("e", "")
        if not fmt in ("bmp", "jpg", "png"):
            return bottle.HTTPResponse(
                status=400, body=json.dumps({"error": "invalid image format: " + fmt})
            )
        thumb = image.copy()
        thumb.thumbnail((300, 60), Image.LANCZOS)
        thumb.save(thumbdata, format=image.format)

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
    s3.Object("diff-pics", "images/" + imagepath).put(
        Body=imagedata.getvalue(), ACL="public-read", ContentType="image/" + fmt
    )
    s3.Object("diff-pics", "thumbs/" + thumbpath).put(
        Body=thumbdata.getvalue(), ACL="public-read", ContentType="image/" + fmt
    )

    db.session.add(db.Image(path=imagepath, thumb=thumbpath, format=fmt))
    db.session.commit()

    return json.dumps({"image": imagepath, "thumb": thumbpath})

