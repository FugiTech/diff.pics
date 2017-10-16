'use strict';

require('./check-versions')()

process.env.NODE_ENV = 'production'

var ora = require('ora')
var rm = require('rimraf')
var path = require('path')
var chalk = require('chalk')
var webpack = require('webpack')
var config = require('../config')
var webpackConfig = require('./webpack.prod.conf')

var yaml = require('js-yaml')
var fs = require('fs')
var translations = Object.assign(...fs.readdirSync('translations').map((fname) => {
  var o = {}
  o[fname.slice(0, -5)] = yaml.safeLoad(fs.readFileSync('translations/'+fname, 'utf8'))
  return o
}))

var mkdirp = require('mkdirp')
var co = require('co')
var AWS = require('aws-sdk')
var mysql = require('mysql')
var ejs = require('ejs')
var s3 = new AWS.S3()
var template = ejs.compile(fs.readFileSync('build/comparison.ejs', 'utf8'))

var p = (fn, ...args) => {
  return new Promise((resolve, reject) => {
    fn(...args, (err, ...result) => {
      if (err === null || err === undefined) {
        resolve(...result)
      } else {
        reject(err)
      }
    })
  })
}

var pool = (concurrency, factory) => {
  let done, fail
  let p = new Promise((resolve, reject) => { done = resolve; fail = reject })
  let f = factory()
  let running = concurrency
  let proceed = () => {
    let r = f.next()
    if (r.done) {
      running--
      if (running === 0) done()
      return
    }
    r.value.then(proceed, fail)
  }
  for (let i = 0; i < concurrency; i++) proceed()
  return p
}

var download = function(url, dest, cb) {
  var file = fs.createWriteStream(dest)
  var request = http.get(url, function(response) {
    response.pipe(file)
    file.on('finish', function() {
      file.close(cb)  // close() is async, call cb after close completes.
    })
  }).on('error', function(err) { // Handle errors
    fs.unlinkSync(dest) // Delete the file async. (But we don't check the result)
    if (cb) cb(err.message)
  })
}

var getAllComparisons = co.wrap(function* () {
  var db = mysql.createConnection(process.env['MYSQL_DSN'])
  var images = {}
  var results = yield p(db.query.bind(db), 'SELECT `id`, `path`, `thumb` FROM `images`')
  results.forEach((row) => {
    images[row.id] = {
      Path: '/images/' + row.path,
      Thumb: '/thumbs/' + row.thumb
    }
  })

  var comparisonImages = {}
  var results = yield p(db.query.bind(db), 'SELECT `comparison_id`, `row`, `column`, `image_id`, `name` FROM `comparison_images`')
  results.forEach((row) => {
    var imgs = comparisonImages[row.comparison_id] || Array()
    var r = imgs[row.row] || Array()
    r[row.column] = {
      Name: row.name,
      Path: images[row.image_id].Path,
      Thumb: images[row.image_id].Thumb,
    }
    imgs[row.row] = r
    comparisonImages[row.comparison_id] = imgs
  })

  var comparisons = []
  var results = yield p(db.query.bind(db), 'SELECT `id`, `key`, `title`, `zip`, `views` FROM `comparisons`')
  results.forEach((row) => {
    comparisons.push({
      Key: row.key,
      Title: row.title,
      Zip: '/zips/' + row.zip,
      Views: row.views,
      Images: comparisonImages[row.id],
    })
  })

  db.destroy()
  return {images, comparisons}
})

// BUILD NORMALLY
co(function* () {
  let start = new Date()
  let spinner = ora('building for production...')
  spinner.start()
  yield p(rm, config.build.assetsRoot)
  mkdirp.sync(config.build.assetsRoot)
  let stats = yield p(webpack, webpackConfig)
  spinner.stop()
  process.stdout.write(stats.toString({
    colors: true,
    modules: false,
    children: false,
    chunks: false,
    chunkModules: false
  }) + '\n\n')
  if (stats.hasErrors()) {
    throw new Error('')
  }

  // Make the _redirects file
  let redirectsData = ''
  // Act like everything is on one subdomain
  redirectsData += '/zips/* https://download.diff.pics/zips/:splat 200\n'
  redirectsData += '/images/* https://static.diff.pics/images/:splat 200\n'
  redirectsData += '/thumbs/* https://static.diff.pics/thumbs/:splat 200\n'
  // Make /:comparison work
  redirectsData += '/:comparison/ /:comparison/1 301\n'
  // Redirect translated languages to their own folders
  Object.keys(translations).forEach((locale) => {
    mkdirp.sync(config.build.assetsRoot+`/${locale}/`)
    redirectsData += `/ /${locale}/ 200 Language=${locale}\n`
    redirectsData += `/:comparison/:index https://api.diff.pics/comparison/${locale}/:comparison/:index 200 Language=${locale}\n`
  })
  // Default to english
  redirectsData += `/ /en/ 200\n`
  redirectsData += `/:comparison/:index https://api.diff.pics/comparison/en/:comparison/:index 200\n`
  fs.writeFileSync(config.build.assetsRoot+`/_redirects`, redirectsData)

  // Now, delete index.html and put it in the localized directories
  let indexData = fs.readFileSync(config.build.assetsRoot+`/index.html`, 'utf8')
  fs.unlinkSync(config.build.assetsRoot+`/index.html`)
  Object.keys(translations).forEach((locale) => {
    fs.writeFileSync(config.build.assetsRoot+`/${locale}/index.html`, indexData.replace(/{{LOCALE}}/g, locale))
  })

  // Add comparisons & images
  // spinner = ora('fetching comparisons...')
  // spinner.start()
  // let data = yield getAllComparisons()
  // spinner.stop()
  //
  // spinner = ora('writing comparisons...')
  // spinner.start()
  // yield pool(50, function* () {
  //   let locales = Object.keys(translations)
  //   for (let c = 0; c < data.comparisons.length; c++) {
  //     let comp = data.comparisons[c]
  //     for (let l = 0; l < locales.length; l++) {
  //       let locale = locales[l]
  //       mkdirp.sync(config.build.assetsRoot+`/${locale}/${comp.Key}/`)
  //       for (var i = 0; i < comp.Images.length; i++) {
  //         yield p(fs.writeFile, config.build.assetsRoot+`/${locale}/${comp.Key}/${i+1}.html`, template({
  //           Key: comp.Key,
  //           Title: comp.Title,
  //           Zip: comp.Zip,
  //           Views: comp.Views,
  //           Images: comp.Images,
  //           Translations: translations[locale],
  //           Selected: i,
  //           label: (n) => { if (n < 10) { return ''+n } return String.fromCharCode(55 + n) }
  //         }))
  //       }
  //     }
  //   }
  // })
  // spinner.stop()

  // spinner = ora('copying images...')
  // spinner.start()
  // yield pool(50, function* () {
  //   let f = (_path) => {
  //     mkdirp.sync(config.build.assetsRoot+path.dirname(_path))
  //     return p(download, 'https://diff.pics${_path}', `${config.build.assetsRoot}${_path}`).then(null, () => {
  //       return p(s3.getObject.bind(s3), { Bucket: 'diff.pics', Key: _path.substr(1) }).then((data) => {
  //         return p(fs.writeFile, `${config.build.assetsRoot}${_path}`, data)
  //       })
  //     })
  //   }
  //   for (let k in data.images) {
  //     let img = data.images[k]
  //     yield f(img.Path)
  //     yield f(img.Thumb)
  //   }
  //   for (let i = 0; i < data.comparisons.length; i++) {
  //     yield f(data.comparisons[i].Zip)
  //   }
  // })
  // spinner.stop()

  let countDir = (path) => {
    let c = 0
    fs.readdirSync(path).map((fname) => {
      let f = path + '/' + fname
      if (fs.lstatSync(f).isDirectory()) {
        c += countDir(f)
      } else {
        c++
      }
      return f
    })
    return c
  }

  let fileCount = countDir('dist')
  let magicNumber = 60000
  let dropped = 0
  // if (fileCount >= magicNumber) {
  //   let folders = fs.readdirSync('dist/fr').sort()
  //   while (fileCount >= magicNumber) {
  //     let f = folders.pop()
  //     let c = countDir('dist/fr/'+f)
  //     dropped += c
  //     fileCount -= c
  //     yield p(rm, 'dist/fr/'+f)
  //   }
  // }

  let end = new Date()
  console.log(chalk.cyan(`Build complete! ${end - start}ms`))
  console.log(chalk.cyan(`Generated ${fileCount} files`))
  console.log(chalk.cyan(`Dropped ${dropped} files`))
}).then(null, (err) => {
  console.log(chalk.red('Build failed with errors.\n'))
  console.log(err)
  process.exit(1)
})
