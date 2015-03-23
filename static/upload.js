var COLUMNS = ["",""];
var IMAGES = [];
var SHAS = {};
var RUSHA = new Worker("static/rusha.js");
var COMPARE = MassImageCompare();
var JOBS = {}, LAST_JOB_ID = 0;

RSVP.on("error", function (e) {
  console.error(e);
});

function nameAndExt(filename) {
  var a = filename.split(".");
  if (a.length <= 1) return [a[0], "png"]; // Uh oh
  return [_.initial(a).join("."), _.last(a)];
}

// DEBUG
function debugImages() {
  return JSON.stringify(_.map(IMAGES, function (comparison) {
    return _.pluck(comparison, "name");
  }));
}

// Set up UI
$(function () {
  $("#title").attr("placeholder", ich.comparison_title().text());
  $("#add").html(ich.add_comparison());
  $("#rename > h3").html(ich.rename_comparison());
  $("#swap").html(ich.swap_columns());
  $("#submit").html(ich.submit_comparison());
  $("#hide").html(ich.accept());
  $("#footer").html(ich.footer({
    "github": '<a href="https://github.com/Fugiman/diff.pics/issues">Github</a>',
    "twitter": '<a href="https://twitter.com/fugiman">Twitter</a>'
  }));
  $("#magic").html(ich.magic_prompt());
  $("#wizard > h1").html(ich.wizard_title());

  $("#comparisons").sortable({
    axis: "y",
    containment: "parent",
    cursor: "row-resize",
    handle: ".number",
    update: function (event, ui) {
      var row = $(ui.item[0]);
      var oldIndex = row.find(".number").text() * 1 - 1;
      var newIndex = row.index();
      var data = IMAGES.splice(oldIndex, 1);
      IMAGES.splice(newIndex, 0, data[0]);
      recalculateComparisons();
    }
  });
  createComparison();
});

// Drage & Drop UI
$(document).on("dragover", ".image", function () {
  $(this).addClass("hover");
  return false;
});
$(document).on("dragleave", ".image", function () {
  $(this).removeClass("hover");
  return false;
});
$(document).on("dragend", ".image", function () {
  return false;
});
$(document).on("input", ".image > input", function () {
  var container = $(this).parent();
  var file = getFileFor(container);
  file.goodName = $(this).val() + "." + nameAndExt(file.goodName)[1];
  console.log(file.goodName);
});
$(document).on("input", "#rename > input", function () {
  recalculateColumn($(this).index() - 1);
});

// Image Uploader
function getFileFor(container) {
  var comparison = container.parent().index();
  var column = container.index() - 1;
  return IMAGES[comparison][column];
};
function load(container, file) {
  var comparison = container.parent().index();
  var column = container.index() - 1;
  IMAGES[comparison][column] = file;

  if (!file) {
    container.find("img").attr("src", "");
    container.children('input').val("").hide();
    return;
  }

  file.container = container;
  file.url = file.url || window.URL.createObjectURL(file);
  file.goodName = file.name;

  container.find("img").attr("src", file.url);
  container.children('input').val(nameAndExt(file.goodName)[0]).toggle(!COLUMNS[column]);

  sha1(file).then(function (hash) {
    file.sha1 = hash;
    SHAS[hash] = false;
    checkSha(hash);
  });
}
$(document).on("drop", ".image", function (e) {
  var target = $(this);
  var data = e.originalEvent.dataTransfer;
  target.removeClass("hover");
  if (data.files.length) {
    load(target, data.files[0]);
  } else {
    var file = _.chain(IMAGES).flatten().find("url", data.getData("URL")).value();
    var replaced = getFileFor(target);
    var source = file.container;
    load(target, file);
    load(source, replaced);
  }
  return false;
});
$(document).on("change", ".image > .button > input", function () {
  load($(this).parent().parent(), this.files[0]);
  return false;
});

// Add & Remove comparisons
function createComparison() {
  IMAGES.push([]);
  var num = $("#comparisons > div").length + 1;
  var row = ich.comparison({
    number: num,
    remove: ich.remove_comparison().html(),
    drop: ich.upload_drop().html(),
    or: ich.upload_or().html(),
    browse: ich.upload_browse().html()
  });
  if (num >= 10) row.find(".number").addClass("large-number");
  $("#comparisons").append(row);
  $("#comparisons").sortable("refresh");
};
function recalculateComparisons() {
  $(".comparison").each(function (index) {
    $(this).find(".number").text(index + 1).toggleClass("large-number", index >= 10);
  });
  $("#comparisons").sortable("refresh");
};
function recalculateColumn(column) {
  COLUMNS[column] = $("#rename > input:nth-child("+(column + 2)+")").val();
  $(".image:nth-child("+(column + 2)+")").each(function (comparison) {
    $(this).children('input').toggle(IMAGES[comparison][column] && !COLUMNS[column]);
  });
};
function removeComparison(index) {
  IMAGES.splice(index, 1);
  $("#comparisons > div:nth-child("+(index + 1)+")").remove();
  recalculateComparisons();
};

$(document).on("click", "#add", function () {
  createComparison();
  return false;
});
$(document).on("click", ".remove", function () {
  removeComparison($(this).parent().index());
  return false;
});
$(document).on("click", "#swap", function () {
  // First, swap the titles
  var t = COLUMNS[1];
  COLUMNS[1] = COLUMNS[0];
  COLUMNS[0] = t;
  $("#rename > input:nth-child(2)").val(COLUMNS[0]);
  $("#rename > input:nth-child(3)").val(COLUMNS[1]);

  // Now swap all the files
  _.each(IMAGES, function (comparison) {
    var a = comparison[0],
        b = comparison[1],
        ac = a.container,
        bc = b.container;
    load(ac, b);
    load(bc, a);
  });
  return false;
});

// Sha1 calculation
function sha1(file) {
  if (file.sha1) return RSVP.resolve(file.sha1);
  var job_id = ++LAST_JOB_ID;
  var d = RSVP.defer();
  JOBS[job_id] = d;
  RUSHA.postMessage({
    id: job_id,
    data: file
  });
  return d.promise;
}

RUSHA.onmessage = function (e) {
  JOBS[e.data.id].resolve(e.data.hash.toUpperCase());
  delete JOBS[e.data.id];
};

function checkSha(hash) {
  return RSVP.resolve($.get("/check/"+hash)).then(function (r) {
    _.merge(SHAS, JSON.parse(r));
  });
}

// Uploader
$(document).on("click", "#submit", function () {
  $("#upload > progress").show();
  $("#upload").show();
  uploadAllImages().then(function () {
    return submit();
  }).catch(function (e) {
    $("#upload > h1").html(ich.error({error_message: e}));
  }).then(function () {
    $("#upload > progress").hide();
    $("#hide").show();
  });
  return false;
});

$(document).on("click", "#hide", function () {
  $("#hide").hide();
  $("#upload").hide();
  return false;
});

function remaining() {
  return _.reduce(IMAGES, function (r, images) {
    return r.concat(_.filter(images, function (image) {
      return image && image.sha1 && !SHAS[image.sha1];
    }));
  }, []);
}

function uploadAllImages() {
  $("#upload > h1").html(ich.uploading_search());
  var hashes = _.pluck(remaining(), "sha1");
  if (!hashes.length) return RSVP.resolve();

  return checkSha(hashes.join(",")).catch(function () {
    return true; // Eat the error
  }).then(function () {
    var r = remaining();
    if (!r.length) return RSVP.resolve();

    return upload(r[0]).then(function () {
      return uploadAllImages();
    });
  });
}

function upload(file) {
  $("#upload > h1").html(ich.uploading_image({filename: file.goodName}));
  $("#upload > img").attr("src", window.URL.createObjectURL(file));

  // Caching this lookup for performance causes headaches, so YOLO
  var comparison, column;
  _.each(IMAGES, function (data, _comparison) {
    _.each(data, function (_file, _column) {
      if (file.sha1 === _file.sha1) {
        if (comparison && column) {
          // You tried to upload the same file twice. Goddammit.
          throw new Error(ich.duplicate_file_error.text());
        } else {
          comparison = _comparison;
          column = _column;
        }
      }
    });
  });

  var filename = file.goodName;
  if (COLUMNS[column]) {
    filename = COLUMNS[column] + "." + nameAndExt(file.goodName)[1];
  }

  var data = new FormData();
  data.append("image", file);
  data.append("filename", filename);
  return RSVP.resolve($.ajax({
    type: "POST",
    url: "/upload",
    data: data,
    processData: false,
    contentType: false,
    xhr: function () {
      var xhr = new window.XMLHttpRequest();
      xhr.upload.addEventListener("progress", function(evt){
        if (evt.lengthComputable) {
          $("#upload > progress").attr("value", evt.loaded / evt.total);
        }
      }, false);
      return xhr;
    }
  })).then(function (r) {
    $("#upload > img").attr("src", "");
    $("#upload > progress").attr("value", null);

    if (r.split(" ")[1] != "=") {
      throw r;
    }
  });
}

function submit() {
  $("#upload > h1").html(ich.uploading_submit());
  return RSVP.resolve($.ajax({
    type: "POST",
    url: "/submit",
    data: {
      title: $("#title").val(),
      comparisons: JSON.stringify(_.map(IMAGES, function (comparison) {
        return _.pluck(comparison, "sha1");
      }))
    }
  })).then(function (r) {
    if (_.contains(r, " ")) {
      throw r;
    } else {
      window.location = "/" + r;
    }
  });
}

// Magical Auto-comparison bullshit
var hideMagic = _.debounce(function () { $("#magic").hide(); }, 100);

$(document).on("dragover", function (e) {
  // Browser hacks to figure out how many items they want to drop
  var data = e.originalEvent.dataTransfer;
  var count = data.mozItemCount || data.items.length;
  var show = count > 1 && _.includes(data.types, "Files");
  $("#magic").toggle(show);
  hideMagic();
  return false;
});

$(document).on("drop", "#magic", function (e) {
  magic(e.originalEvent.dataTransfer.files);
  return false;
});

function magic(files) {
  var start = Date.now();
  $("#wizard").show();

  var comparisons = {}
  for (var i = 0; i < files.length; i++)
    comparisons[i] = [];

  _.each(files, function (file) {
    file.url = window.URL.createObjectURL(file);
  });

  var images = _.pluck(files, "url");
  $("#wizard > div").empty();
  _.each(images, function (image) {
    $("#wizard > div").append($("<img>").attr("src", image));
  });

  var onprogress = function (completed) {
    $("#wizard > progress").attr("value", completed);
  };

  COMPARE.compare(images, false, onprogress).then(function (data) {
    $("#wizard").hide();

    if (_.isEmpty(_.last(IMAGES))) {
      removeComparison(IMAGES.length - 1);
    }

    _.each(data, function (d) {
      comparisons[d.a][d.b] = 1 * d.p;
    });

    var compare = function (_a, _b) {
      var a = Math.min(_a, _b),
          b = Math.max(_a, _b);
      return comparisons[a][b];
    }

    var done = {};
    var together = [];
    var last_b = 0;
    _.each(_.range(files.length), function (a) {
      if (a in done) return;
      var d = _.min(comparisons[a]);
      var b = _.indexOf(comparisons[a], d);

      // Uhh, something went terribly wrong and let's just ignore it
      // But seriously, this is typically caused by users trying to compare files
      // with different resolutions, which we don't support.
      // 90% is a nice magic number that seems to work pretty well
      if (d > 90) return;

      done[a] = done[b] = true;
      together.push([d, a, b]);
    });

    var awords = [], bwords = [];
    _.each(_.sortByOrder(together, [0], [false]), function (i, n) {
      console.info("Comparison #" + (n+1) + " is " + i[0] + "% different");
      createComparison();
      var containers = $("#comparisons > div:last-child .image");
      var a = files[i[1]], b = files[i[2]];
      load($(containers[0]), a);
      load($(containers[1]), b);

      awords.push(_.words(nameAndExt(a.goodName)[0]));
      bwords.push(_.words(nameAndExt(b.goodName)[0]));
    });

    // Try to set sane titles if we can
    var column_title = function (v, i) {
      v = _.chain(v).unzip().map(_.uniq).filter("length", 1).flatten().value().join(" ");
      i = $(i);
      if (v && !i.val()) i.val(v);
      return v;
    };
    column_title([
      _.words(column_title(awords, "#rename > input:nth-child(2)")),
      _.words(column_title(bwords, "#rename > input:nth-child(3)"))
    ], "#title");
    recalculateColumn(0);
    recalculateColumn(1);

    console.debug("Time spent during Mass Compare: "+(Date.now() - start)+"ms");
  }).catch(function (e) {
    $("#wizard > h1").html(ich.error({error_message: e.message}));
  });
};
