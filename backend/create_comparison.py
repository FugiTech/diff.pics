import random, string, json, bottle

import db


def handler(event, context):
    data = event["extensions"]["request"].json
    paths = []
    names = {}
    for row in data["images"]:
        for i in row:
            if i["name"] in names:
                return bottle.HTTPResponse(
                    status=400, body=json.dumps({"error": "Duplicate name"})
                )
            names[i["name"]] = True
            h = i["sha"]
            paths.append(h[0:2] + "/" + h[2:4] + "/" + h[4:])
    if len(paths) == 0:
        return bottle.HTTPResponse(
            status=400, body=json.dumps({"error": "No images to compare"})
        )

    found = db.session.query(db.Image).filter(db.Image.path.in_(paths)).all()
    images = {f.path.replace("/", ""): f for f in found}

    key, key_length = None, 12
    while not key:
        key = "".join(
            random.choice(string.ascii_letters + string.digits)
            for _ in range(key_length)
        )
        if (
            db.session.query(db.Comparison).filter(db.Comparison.key == key).first()
            is None
        ):
            break
        key, key_length = None, key_length + 1

    comp = db.Comparison(key=key, title=data["title"], views=0)
    db.session.add(comp)
    for (rownum, row) in enumerate(data["images"]):
        for (colnum, col) in enumerate(row):
            img = images.get(col["sha"], None)
            if img is None:
                return bottle.HTTPResponse(
                    status=400,
                    body=json.dumps(
                        {"error": 'Couldn\'t lookup image "{}"'.format(col["sha"])}
                    ),
                )
            db.session.add(
                db.ComparisonImage(
                    row=rownum,
                    column=colnum,
                    name=col["name"],
                    comparison=comp,
                    image=img,
                )
            )
    db.session.commit()

    return json.dumps({"URL": "/{}/1".format(key)})
