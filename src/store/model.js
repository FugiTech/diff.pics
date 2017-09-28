let normalizeKeys = (self, keys) => {
  let a = []
  keys.forEach((k) => {
    a.push(k[0] === ':' ? self[k.substr(1)] : k)
  })
  return a
}

export default function (...props) {
  return {
    get () {
      let keys = normalizeKeys(this, props)
      let o = this.$store.state
      keys.forEach((k) => {
        if (o) o = o[k]
      })
      return o
    },
    set (value) {
      let keys = normalizeKeys(this, props)
      this.$store.commit('updateModel', {keys, value})
    }
  }
}
