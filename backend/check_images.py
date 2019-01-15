import db, json


def handler(event, context):
    hashes = event["extensions"]["request"].json
    paths = [h[0:2] + "/" + h[2:4] + "/" + h[4:] for h in hashes]
    found = db.session.query(db.Image).filter(db.Image.path.in_(paths)).all()
    toupload = set(paths) - set([f.path for f in found])
    return json.dumps({t.replace("/", ""): t for t in toupload})
