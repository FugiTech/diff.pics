let getImageData = (file) => {
  let img = document.createElement('img')
  let canvas = document.createElement('canvas')
  let url = window.URL.createObjectURL(file)

  return (new Promise((resolve) => {
    img.onload = resolve
    img.src = url
  })).then(() => {
    // Downscale to a height of 45px, maintaining aspect ratio
    canvas.width = img.width / (img.height / 45)
    canvas.height = 45
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)

    let data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)
    return data
  })
}

let getPixel = (data, offset) => {
  let r, g, b, a

  r = data[offset]
  if (typeof r !== 'undefined') {
    g = data[offset + 1]
    b = data[offset + 2]
    a = data[offset + 3]
    return {r: r, g: g, b: b, a: a}
  } else {
    return null
  }
}

let calculateBrightness = (p) => {
  // This magic voodoo function was stolen from resemble.js
  p.brightness = 0.3 * p.r + 0.59 * p.g + 0.11 * p.b
}

let isSimilar = (a, b) => {
  // Another magic number from resemble.js
  return a === b || Math.abs(a - b) < 16
}

// Returns how different two images are in a percentage from 0 to 100
let compareIndividual = (a, b, ignoreColor) => {
  let width, height, pa, pb, offset, mismatch
  // Don't bother comparing different sized images
  if (a.width !== b.width || a.height !== b.height) return 100.0

  width = a.width
  height = a.height
  a = a.data
  b = b.data
  mismatch = 0

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      offset = (y * width + x) * 4
      pa = getPixel(a, offset)
      pb = getPixel(b, offset)
      if (pa === null || pb === null) continue

      if (ignoreColor) {
        calculateBrightness(pa)
        calculateBrightness(pb)
        if (!isSimilar(pa.brightness, pb.brightness) || !isSimilar(pa.a, pb.a)) {
          mismatch++
        }
      } else {
        if (!isSimilar(pa.r, pb.r) || !isSimilar(pa.g, pb.g) || !isSimilar(pa.b, pb.b) || !isSimilar(pa.a, pb.a)) {
          mismatch++
        }
      }
    }
  }

  return (mismatch / (height * width) * 100).toFixed(2)
}

export default function (files, ignoreColor, onProgress) {
  if (!onProgress) onProgress = () => {} // Default to no-op

  let complete = 0
  onProgress(complete / files.length)

  let promises = []
  for (let i = 0; i < files.length; i++) {
    promises.push(getImageData(files[i]).then((data) => {
      // Report progress on loading the images, since comparison is so fast
      onProgress(++complete / files.length)
      return data
    }))
  }

  return Promise.all(promises).then((data) => {
    let comparisons = []

    for (let i = 0; i < data.length; i++) {
      for (let j = i + 1; j < data.length; j++) {
        comparisons.push({
          a: i,
          b: j,
          p: compareIndividual(data[i], data[j], ignoreColor)
        })
      }
    }

    return comparisons
  })
}
