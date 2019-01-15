from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, String, ForeignKey

username = ""
password = ""

with open("/mysql-creds/username", "r") as f:
    username = f.read()
with open("/mysql-creds/password", "r") as f:
    password = f.read()

engine = create_engine(
    "mysql+pymysql://{username}:{password}@mysql.default/diff.pics".format(
        username=username, password=password
    ),
    pool_recycle=3600,
)
session = sessionmaker(bind=engine)()

Base = declarative_base()


class ComparisonImage(Base):
    __tablename__ = "comparison_images"
    id = Column(Integer, primary_key=True)
    row = Column(Integer)
    column = Column(Integer)
    name = Column(String)
    comparison_id = Column(Integer, ForeignKey("comparisons.id"))
    image_id = Column(Integer, ForeignKey("images.id"))

    comparison = relationship("Comparison", back_populates="comparison_images")
    image = relationship("Image", back_populates="comparison_images")


class Comparison(Base):
    __tablename__ = "comparisons"
    id = Column(Integer, primary_key=True)
    key = Column(String)
    title = Column(String)
    views = Column(Integer)

    comparison_images = relationship(
        "ComparisonImage", back_populates="comparison", order_by=ComparisonImage.id
    )


class Image(Base):
    __tablename__ = "images"
    id = Column(Integer, primary_key=True)
    path = Column(String)
    thumb = Column(String)
    format = Column(String)

    comparison_images = relationship(
        "ComparisonImage", back_populates="image", order_by=ComparisonImage.id
    )

