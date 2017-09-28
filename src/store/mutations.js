import Vue from 'vue'

export const updateModel = (state, data) => {
  let n = data.keys
  let o = state
  for (let i = 0; i < n.length - 1; i++) {
    let k = n[i]
    o = o[k]
  }
  Vue.set(o, n[n.length - 1], data.value)
}

let imageData = {
  name: '',
  src: '',
  sha1: '',
  file: null
}

export const addRow = (state) => {
  let a = []
  for (let i = 0; i < state.massNames.length; i++) {
    a.push(Object.assign({}, imageData))
  }
  state.images.push(a)
}

export const removeRow = (state, idx) => {
  state.images.splice(idx, 1)
}

export const addColumn = (state) => {
  state.massNames.push('')
  state.images.forEach((a) => {
    a.push(Object.assign({}, imageData))
  })
}

export const removeColumn = (state) => {
  state.massNames.splice(-1)
  state.images.forEach((a) => {
    a.splice(-1)
  })
}

export const moveImage = (state, data) => {
  if (data.from.column < 0) data.from.column += 2
  let removed = state.images[data.from.row].splice(data.from.column, 1)
  state.images[data.to.row].splice(data.to.column, 0, ...removed)
}
