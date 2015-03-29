CDN = "http://cdn.diff.pics/";
ID = "";
INDEX = 0;
PIC = 0;
ALPHABET = "123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

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
  // Now decrement it by one
  INDEX--;
};
function getURL() {
  return "/" + ID + "/" + (INDEX+1)
}

// ...on start up
(function () {
  setIDandINDEX();
  history.replaceState(null, "", getURL());
})();

// ...and when the user presses back
window.addEventListener('popstate', function () {
  setIDandINDEX();
  setComparison(INDEX);
});

// Now that UI is ready, let's start loading stuff!
$(function () {
  $("#preload").find("h1").html(ich.loading());
  $("#footer").html(ich.footer({
    "github": '<a href="https://github.com/Fugiman/diff.pics/issues">Github</a>',
    "twitter": '<a href="https://twitter.com/fugiman">Twitter</a>'
  }));

  COMPARISONS = _.filter(COMPARISONS, function (c) { return c.length > 0; });
  if (COMPARISONS.length > 1) {
    _.each(COMPARISONS, function (comparison) {
      $("#selector").append($("<img>"));
    });
  }

  loadComparison(INDEX).then(function () {
    $("#preload").css("opacity", 0);
    setComparison(INDEX);

    for (var i = 0; i < COMPARISONS.length; i++) {
      if (i === INDEX) continue;
      loadComparison(i);
    }
  });
});

// Handle the user trying to swap comparisons properly
$(document).on("click", "#selector img", function () {
  setComparison($(this).index());
  history.pushState(null, "", getURL());
});

// Handle switching pics in multi-image comparisons
$(document).on("click", ".subselect", function () {
  setComparison(INDEX, $(this).index());
});

$(document).on("keydown", function (e) {
  var key = e.keyCode;
  var p = -1;

  if (49 <= key && key <= 57) p = key - 49; // 1-9
  if (97 <= key && key <= 105) p = key - 97; // 1-9 (keypad)
  if (65 <= key && key <= 90) p = key - 55; // a-z
  if (key == 37 || key == 38) p = PIC - 1; // LEFT or UP
  if (key == 39 || key == 40) p = PIC + 1; // RIGHT or DOWN
  if (p < 0 || p >= COMPARISONS[INDEX].length) return;

  setComparison(INDEX, p);
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

function setComparison(i, p) {
  PIC = p || 0;
  var c = COMPARISONS[i];

  // TRACKING
  if (i !== INDEX) {
    INDEX = i;
    ga('send', 'pageview', getURL());
  }

  // Set the main image
  $("#main").text(c[PIC].name);
  $("#comparison img").attr("src", CDN + c[PIC].hash);

  // Set the hover image to the other image if we only have 2, otherwise don't change on hover
  var hover_index = c.length === 2 ? 1 - PIC : PIC;
  $("#hover").text(c[hover_index].name);
  $("#comparison").css("background-image", "url(" + CDN + c[hover_index].hash + ")");

  // If we have more than 2 images, allow swapping between them with buttons/number keys
  $("#subselector").empty();
  if (c.length > 2) {
    _.each(c, function (p, i) {
      $("#subselector").append(ich.subselect({
        number: ALPHABET[i],
        name: p.name
      }));
    });
  }
}
