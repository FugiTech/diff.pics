from jinja2 import Environment, FileSystemLoader, select_autoescape
import os, string

import db

image_host = "https://diff-pics.sfo2.cdn.digitaloceanspaces.com"

env = Environment(
    loader=FileSystemLoader(os.path.dirname(__file__)),
    autoescape=select_autoescape(["html", "xml"]),
)


def handler(event, context):
    p = event["extensions"]["request"].path.split("/")
    key = p[1] if len(p) > 1 else "<invalid>"
    idx = int(p[2]) if len(p) > 2 else 1

    selectors = []
    selected_images = []

    comparison = (
        db.session.query(db.Comparison).filter(db.Comparison.key == key).first()
    )
    if comparison is None:
        return "No comparison found for key: " + key

    comparison.views = db.Comparison.views + 1
    db.session.commit()

    for ci in comparison.comparison_images:
        if ci.row == idx - 1:
            # Ensure ci.column is a valid index in selected_images
            # and hope later iterations fill in the Nones
            selected_images += [None] * (ci.column - len(selected_images) + 1)
            selected_images[ci.column] = {
                "name": ci.name,
                "url": image_host + "/images/" + ci.image.path,
            }
        if ci.column == 0:
            # Ensure ci.row is a valid index in selectors
            # and hope later iterations fill in the Nones
            selectors += [None] * (ci.row - len(selectors) + 1)
            selectors[ci.row] = image_host + "/thumbs/" + ci.image.thumb

    template = env.get_template("comparison.jinja2")
    return template.render(
        key=comparison.key,
        title=comparison.title,
        views=comparison.views,
        selected_images=selected_images,
        selectors=selectors,
        labels=string.digits[1:] + string.ascii_uppercase,
    )
