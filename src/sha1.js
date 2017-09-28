import Rusha from 'worker-loader!rusha'

let rusha = new Rusha()
let jobs = {}
let jid = 1
let sha1 = (file) => {
  return new Promise((resolve) => {
    jobs[jid] = resolve
    rusha.postMessage({
      id: jid,
      data: file
    })
    jid++
  })
}
rusha.onmessage = (e) => {
  jobs[e.data.id](e.data.hash.toUpperCase())
  delete jobs[e.data.id]
}

export default sha1
