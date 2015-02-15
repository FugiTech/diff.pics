CDN = "http://diff.pics.s3-website-us-east-1.amazonaws.com/";

RSVP.on("error", function (e) {
  console.error(e);
});

$(function () {
  COMPARISONS = _.filter(COMPARISONS, "length", 2);
  if (COMPARISONS.length > 1) {
    _.each(COMPARISONS, function (comparison) {
      $("#selector").append($("<img>"));
    });
  }

  loadComparison(0).then(function () {
    $("#preload").css("opacity", 0);
    setComparison(0);

    for (var i = 1; i < COMPARISONS.length; i++) {
      loadComparison(i);
    }
  });
});

$(document).on("click", "#selector img", function () {
  setComparison($(this).index());
});

function loadComparison(index) {
  var loading = [];
  _.each(COMPARISONS[index], function (image) {
    var d = RSVP.defer();
    var img = $("<img>");
    img.on("load", function () { d.resolve(); });
    img.on("error", function () { d.reject(); });
    img.attr("src", CDN + image.hash);
    $("#preload").append(img);
    loading.push(d.promise);
  });
  return RSVP.all(loading).then(function () {
    var selectors = $("#selector img");
    if (selectors.length) {
      selectors[index].src = CDN + COMPARISONS[index][0].hash;
    }
  });
}

function setComparison(index) {
  $("#comparison img").attr("src", CDN + COMPARISONS[index][0].hash);
  $("#comparison").css("background-image", "url(" + CDN + COMPARISONS[index][1].hash + ")");

  $("#main").text(COMPARISONS[index][0].name);
  $("#hover").text(COMPARISONS[index][1].name);
}
