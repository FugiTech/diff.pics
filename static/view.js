CDN = "http://cdn.diff.pics/";
ID = "";
INDEX = 1;

RSVP.on("error", function (e) {
  console.error(e);
});

// Ensure ID and INDEX match current URL - always
function setIDandINDEX() {
  var d = _.trim(URI().path(true), "/").split("/");
  ID = d[0];
  // Sets INDEX to the second path parameter, and bounds it to 1 <= ID <= comparisons.length
  var i = parseInt(d[1]);
  if (isNaN(i)) i = 0;
  INDEX = Math.min(Math.max(i, 1), COMPARISONS.length);
};

// ...on start up
(function () {
  setIDandINDEX();
  history.replaceState(null, "", "/" + ID + "/" + INDEX);
})();

// ...and when the user presses back
window.addEventListener('popstate', function () {
  setIDandINDEX();
  ga('send', 'pageview', "/" + ID + "/" + INDEX);
  setComparison(INDEX - 1);
});

// Now that UI is ready, let's start loading stuff!
$(function () {
  $("#preload").find("h1").html(ich.loading());
  $("#footer").html(ich.footer({
    "github": '<a href="https://github.com/Fugiman/diff.pics/issues">Github</a>',
    "twitter": '<a href="https://twitter.com/fugiman">Twitter</a>'
  }));

  COMPARISONS = _.filter(COMPARISONS, "length", 2);
  if (COMPARISONS.length > 1) {
    _.each(COMPARISONS, function (comparison) {
      $("#selector").append($("<img>"));
    });
  }

  loadComparison(INDEX - 1).then(function () {
    $("#preload").css("opacity", 0);
    setComparison(INDEX - 1);

    for (var i = 0; i < COMPARISONS.length; i++) {
      if (i === INDEX - 1) continue;
      loadComparison(i);
    }
  });
});

// Handle the user trying to swap comparisons properly
$(document).on("click", "#selector img", function () {
  INDEX = $(this).index() + 1;
  setComparison(INDEX - 1);
  history.pushState(null, "", "/" + ID + "/" + INDEX);
  ga('send', 'pageview', "/" + ID + "/" + INDEX);
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
