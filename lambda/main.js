const crypto = require('crypto')

const co = require('co')
const gm = require('gm').subClass({ imageMagick: true }) // Enable ImageMagick integration.
const AWSXRay = require('aws-xray-sdk')
const AWS = AWSXRay.captureAWS(require('aws-sdk'))
const mysql = AWSXRay.captureMySQL(require('mysql'))

const MAX_WIDTH  = 300
const MAX_HEIGHT =  60

const s3 = new AWS.S3()
const kms = new AWS.KMS()

let p = (fn, ...args) => {
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

let hash = (data) => {
  let hasher = crypto.createHash('sha1')
  hasher.update(data)
  let digest = hasher.digest('hex').toUpperCase()
  return `${digest.substr(0,2)}/${digest.substr(2,2)}/${digest.substr(4)}`
}

let gmToBuffer = (data) => {
  return new Promise((resolve, reject) => {
    data.stream((err, stdout, stderr) => {
      if (err) { return reject(err) }
      const chunks = []
      stdout.on('data', (chunk) => { chunks.push(chunk) })
      // these are 'once' because they can and do fire multiple times for multiple errors,
      // but this is a promise so you'll have to deal with them one at a time
      stdout.once('end', () => { resolve(Buffer.concat(chunks)) })
      stderr.once('data', (data) => { reject(String(data)) })
    })
  })
}

let dsn = p(kms.decrypt.bind(kms), { CiphertextBlob: new Buffer(process.env['MYSQL_DSN'], 'base64') })

exports.handler = function (event, context, callback) {
  co(function* () {
    let MYSQL_DSN = yield dsn
    MYSQL_DSN = MYSQL_DSN.Plaintext.toString('ascii')

    for (let i = 0; i < event.Records.length; i++) {
      let record = event.Records[i]

      let bucket = record.s3.bucket.name
      let key = record.s3.object.key
      console.log('Bucket:', bucket, 'Key:', key)
      let file = yield p(s3.getObject.bind(s3), { Bucket: bucket, Key: key })

      let img = gm(file.Body)
      let format = yield p(img.format.bind(img))
      format = format.toLowerCase()
      if (format === 'jpeg') format = 'jpg'
      if (format !== 'png' && format != 'jpg' && format != 'bmp') return console.log('Invalid format:', format) // Invalid format
      let thumb = yield gmToBuffer(img.resize(MAX_WIDTH, MAX_HEIGHT))

      let imgName = hash(file.Body)
      let thumbName = hash(thumb)
      if (imgName.replace(/\//g,'') !== key.replace(/\//g,'')) return console.log('Invalid hash:', key.replace(/\//g,''), 'vs', imgName.replace(/\//g,''))

      yield p(s3.putObject.bind(s3), { Bucket: 'diff.pics', Key: 'images/'+imgName, Body: file.Body, ContentType: 'image/'+format })
      yield p(s3.putObject.bind(s3), { Bucket: 'diff.pics', Key: 'thumbs/'+thumbName, Body: thumb, ContentType: 'image/'+format })

      let conn = mysql.createConnection(MYSQL_DSN)
      yield p(conn.query.bind(conn), 'INSERT INTO images(path, thumb, format) VALUES(?,?,?)', [imgName, thumbName, format])
      yield p(conn.end.bind(conn))

      yield p(s3.deleteObject.bind(s3), { Bucket: bucket, Key: key })
    }
  }).then((result) => {
    callback(null, result)
  }, (err) => {
    console.error(err)
    callback(err)
  })
}
