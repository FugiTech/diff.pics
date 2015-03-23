// Requires RSVP.js and lodash.js
// Steals a lot of ideas from resemble.js and rusha.js
(function () {
  var DOWNSCALE = 16; // Set to 1 to disable. (Not 0!!!)

  // If we'e running in Node.JS, export a module.
  if (typeof module !== 'undefined') {
    module.exports = MassImageCompare;
  }

  // If we're running in a DOM context, export
  // the MassImageCompare object to toplevel.
  else if (typeof window !== 'undefined') {
    window.MassImageCompare = MassImageCompare;
  }

  // If we're running in a webworker, accept
  // messages containing a jobid and a buffer
  // or blob object, and return the hash result.
  if (typeof FileReaderSync !== 'undefined') {
    var comparer = new MassImageCompareWorker();
    self.onmessage = function (event) {
      var comparisons, data = event.data;
      try {
        percentage = comparer.compare(data.a, data.b, data.ignoreColor);
        self.postMessage({percentage: percentage});
      } catch (e) {
        self.postMessage({error: e.stack});
      }
    };
  }

  function SimpleWorker(workerFile) {
    var worker = new Worker(workerFile);
    var running = null;

    function send(data) {
      running = RSVP.defer();
      worker.postMessage(data);
      return running.promise;
    };

    worker.onmessage = function (event) {
      running.resolve(event.data);
      running = null;
    };

    return {
      send: send,
    };
  }

  function Pool(size, constructor) {
    var elements = [];
    var requests = [];

    for (var i = 0; i < size; i++) {
      var e = constructor();
      e.busy = false;
      elements.push(e);
    }

    function cycleRequests() {
      // This order is important!!!
      if (!requests.length) return;
      var e = _.find(elements, "busy", false); // Don't search unless we think we have a request
      if (!e) return;
      var r = requests.shift(); // Don't mutate requests until we know we have a worker
      e.busy = true; // Don't mutate worker until we know we have a request
      r.resolve(e); // Don't return the worker until we mark it busy
    };

    function acquire() {
      var d = RSVP.defer();
      requests.push(d);
      cycleRequests();
      return d.promise;
    };

    function release(e) {
      e.busy = false;
      cycleRequests();
    };

    return {
      acquire: acquire,
      release: release,
    };
  }

  function MassImageCompare(imagePoolSize, canvasPoolSize) {
    "use strict";

    imagePoolSize = imagePoolSize || 20;
    canvasPoolSize = canvasPoolSize || 20;

    var imagePool = new Pool(imagePoolSize, function () {
      return document.createElement("img");
    });

    var canvasPool = new Pool(canvasPoolSize, function () {
      return document.createElement("canvas");
    });


    function getImageData(image) {
      // returns ImageData, containing a data, width and height
      var img, canvas, reader, d = RSVP.defer();

      // Short-circuit if it's already processed
      if (typeof image.data !== 'undefined' && typeof image.width === 'number' && typeof image.height === 'number')
        return RSVP.resolve(image);
      
      return imagePool.acquire().then(function (i) {
        img = i;
        return canvasPool.acquire();
      }).then(function (c) {
        canvas = c;
        img.onload = d.resolve;

        if (typeof image === 'string') {
          img.src = image;
          if (img.complete) return;
        } else {
          reader = new FileReader();
          reader.onload = function (e) {
            img.src = e.target.result;
          };
          reader.readAsDataURL(image);
        }

        return d.promise;
      }).then(function () {
        var data;
        
        canvas.width = img.width / DOWNSCALE;
        canvas.height = img.height / DOWNSCALE;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);

        imagePool.release(img);
        canvasPool.release(canvas);
        return data;
      });
    };

    function getPixel(data, offset) {
      var r, g, b, a;

      r = data[offset];
      if (typeof r !== "undefined") {
        g = data[offset + 1];
        b = data[offset + 2];
        a = data[offset + 3];
        return {r: r, g: g, b: b, a: a};
      } else {
        return null;
      }
    };

    function calculateBrightness(p) {
      // This magic voodoo function was stolen from resemble.js
      // IDK how this math works
      p.brightness = 0.3*p.r + 0.59*p.g + 0.11*p.b;
    };

    function isSimilar(a, b) {
      // Another magic number from resemble.js
      return a === b || Math.abs(a - b) < 16;
    }

    function compareIndividual(a, b, ignoreColor) {
      var width, height, pa, pb, offset, mismatch;
      // Don't bother comparing different sized images
      if (a.width !== b.width || a.height !== b.height)
        return 100.0;

      width = a.width;
      height = a.height;
      a = a.data;
      b = b.data;
      mismatch = 0;

      for (var x = 0; x < width; x++) {
        for (var y = 0; y < height; y++) {
          offset = (y * width + x) * 4;
          pa = getPixel(a, offset);
          pb = getPixel(b, offset);
          if (pa === null || pb === null)
            continue;

          if (ignoreColor) {
            calculateBrightness(pa);
            calculateBrightness(pb);
            if (!isSimilar(pa.brightness, pb.brightness) || !isSimilar(pa.a, pb.a))
              mismatch++;
          } else {
            if (!isSimilar(pa.r, pb.r) || !isSimilar(pa.g, pb.g) || !isSimilar(pa.b, pb.b) || !isSimilar(pa.a, pb.a))
              mismatch++;
          }
        }
      }

      return (mismatch / (height * width) * 100).toFixed(2);
    };

    function compare(images, ignoreColor, onProgress) {
      var complete = 0;
      onProgress(complete/ images.length);

      return RSVP.all(_.map(images, function (img) {
        return getImageData(img).then(function (data) {
          // Report progress on loading the images, since comparison is so fast
          onProgress(++complete / images.length);
          return data;
        });
      })).then(function (data) {
        var comparisons = [];

        _.each(data, function (a, i) {
          _.each(_.slice(data, i+1), function (b, j) {
            j += i + 1;
            comparisons.push({a: i, b: j, p: compareIndividual(a, b, ignoreColor)});
          });
        });

        return comparisons;
      });
    };

    return {
      compare: compare,
    };
  };
})();
