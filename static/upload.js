var COLUMNS = ["",""];
var IMAGES = [];
var SHAS = {};
var RUSHA = new Worker("static/rusha.js");
var JOBS = {}, LAST_JOB_ID = 0;

RSVP.on("error", function (e) {
  console.error(e);
});

function stringInject(message, injector) {
  return _.chain(injector)
          .repeat(message.length)
          .chunk(injector.length)
          .zip(message)
          .flatten(true)
          .value()
          .join("");
}

function nameAndExt(filename) {
  var a = filename.split(".");
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
  $("#submit").html(ich.submit_comparison());
  $("#hide").html(ich.accept());
  $("#footer").html(ich.footer({
    "github": '<a href="https://github.com/Fugiman/diff.pics/issues">Github</a>',
    "twitter": '<a href="https://twitter.com/fugiman">Twitter</a>'
  }));

  IMAGES.push([]);
  createComparison(1);
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
  var comparison = container.parent().index();
  var column = container.index() - 1;
  var file = IMAGES[comparison][column];
  file.goodName = $(this).val() + "." + nameAndExt(file.goodName)[1];
  console.log(file.goodName);
});
$(document).on("input", "#rename > input", function () {
  var column = $(this).index() - 1;
  COLUMNS[column] = $(this).val();
  $(".image:nth-child("+(column + 2)+")").each(function (comparison) {
    $(this).find('input[type="text"]').toggle(IMAGES[comparison][column] && !COLUMNS[column]);
  });
});

// Image Uploader
function load(container, file) {
  file.goodName = file.name;
  var comparison = container.parent().index();
  var column = container.index() - 1;

  IMAGES[comparison][column] = file;
  container.find("img").attr("src", window.URL.createObjectURL(file));
  container.find('input[type="text"]').val(nameAndExt(file.goodName)[0]).show();

  sha1(file).then(function (hash) {
    file.sha1 = hash;
    SHAS[hash] = false;
    checkSha(hash);
  });
}
$(document).on("drop", ".image", function (e) {
  $(this).removeClass("hover");
  load($(this), e.originalEvent.dataTransfer.files[0]);
  return false;
});
$(document).on("change", ".image > .button > input", function () {
  load($(this).parent().parent(), this.files[0]);
  return false;
});

// Add & Remove comparisons
function createComparison(num) {
  var row = ich.comparison({
    number: num,
    remove: stringInject(ich.remove_comparison().text(), "<br>"),
    drop: ich.upload_drop().html(),
    or: ich.upload_or().html(),
    browse: ich.upload_browse().html()
  });
  if (num >= 10) row.find(".number").addClass("large-number");
  $("#comparisons").append(row);
};

$(document).on("click", "#add", function () {
  IMAGES.push([]);
  createComparison($("#comparisons > div").length + 1);
});
$(document).on("click", ".remove", function () {
  IMAGES.splice($(this).parent().index(), 1);

  $(this).parent().remove();
  $(".comparison").each(function (index) {
    $(this).find(".number").text(index + 1).toggleClass("large-number", index >= 10);
  });
});

// Sha1 calculation
function sha1(file) {
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
});

$(document).on("click", "#hide", function () {
  $("#hide").hide();
  $("#upload").hide();
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
