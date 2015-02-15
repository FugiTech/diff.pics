LOADING = [];
CDN = "http://diff.pics.s3-website-us-east-1.amazonaws.com/";

RSVP.on("error", function (e) {
  console.error(e);
});

$(function () {
  COMPARISONS = _.filter(COMPARISONS, "length", 2);
  _.each(COMPARISONS, function (images) {
    _.each(images, function (image) {
      var d = RSVP.defer();
      var img = $("<img>");
      img.on("load", function () { d.resolve(); });
      img.on("error", function () { d.reject(); });
      img.attr("src", CDN + image.hash);
      $("#preload").append(img);
      LOADING.push(d.promise);
    });
  });
  RSVP.all(LOADING).finally(loaded);
});

$(document).on("click", "#selector img", function () {
  setComparison(COMPARISONS[$(this).index()]);
});

function loaded() {
  console.log("LOADED!");
  $("#preload").remove();
  setComparison(COMPARISONS[0]);

  if (COMPARISONS.length > 1) {
    _.each(COMPARISONS, function (comparison) {
      $("#selector").append($("<img>").attr("src", CDN + comparison[0].hash));
    });
  }
}

function setComparison(c) {
  $("#comparison img").attr("src", CDN + c[0].hash);
  $("#comparison").css("background-image", "url(" + CDN + c[1].hash + ")");

  $("#main").text(c[0].name);
  $("#hover").text(c[1].name);
}
