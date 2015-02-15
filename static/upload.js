var IMAGES = [];
var SHAS = {};
var RUSHA = new Worker("static/rusha.js");
var JOBS = {}, LAST_JOB_ID = 0;

RSVP.on("error", function (e) {
  console.error(e);
});

// DEBUG
function debugImages() {
  return JSON.stringify(_.map(IMAGES, function (comparison) {
    return _.pluck(comparison, "name");
  }));
}

// Set up UI
$(function () {
  IMAGES.push([]);
  $("#comparisons").append(ich.comparison({number: 1}));
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

// Image Uploader
function load(container, file) {
  IMAGES[container.parent().index()][container.index() - 1] = file;
  container.find("img").attr("src", window.URL.createObjectURL(file));
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
$(document).on("click", "#add", function () {
  IMAGES.push([]);
  $("#comparisons").append(ich.comparison({
    number: $("#comparisons > div").length + 1
  }));
});
$(document).on("click", ".remove", function () {
  IMAGES.splice($(this).parent().index(), 1);
  $(this).parent().remove();
  $(".comparison").each(function (index) {
    $(this).find(".number").text(index + 1);
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
  return $.get("/check/"+hash).then(function (r) {
    _.merge(SHAS, JSON.parse(r));
  });
}

// Uploader
$(document).on("click", "#submit", function () {
  $("#upload").show();
  uploadAllImages().then(function () {
    return submit();
  });
});

function remaining() {
  return _.reduce(IMAGES, function (r, images) {
    return r.concat(_.filter(images, function (image) {
      return image && image.sha1 && !SHAS[image.sha1];
    }));
  }, []);
}

function uploadAllImages() {
  $("#upload > h1").text("Finding remaining images to upload");
  var hashes = _.pluck(remaining(), "sha1");
  if (!hashes.length) return RSVP.resolve();

  return checkSha(hashes.join(",")).finally(function () {
    var r = remaining();
    if (!r.length) return RSVP.resolve();
    return upload(r[0]).finally(function () {
      return uploadAllImages();
    });
  });
}

function upload(file) {
  $("#upload > h1").text("Uploading " + file.name);
  $("#upload > img").attr("src", window.URL.createObjectURL(file));
  var data = new FormData();
  data.append("image", file);
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
  })).catch(function () {
    return true; // If it fails we'll try again soon enough...
  }).then(function () {
    $("#upload > img").attr("src", "");
    $("#upload > progress").attr("value", null);
  });
}

function submit() {
  $("#upload > h1").text("Submitting comparison");
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
      $("#upload > h1").text("ERROR: " + r);
    } else {
      window.location = "/" + r;
    }
  });
}
