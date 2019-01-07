import Vue from 'vue'
import Vuex from 'vuex'
import state from './state'
import * as getters from './getters'
import * as mutations from './mutations'
import * as actions from './actions'

Vue.use(Vuex)

const debug = process.env.NODE_ENV !== 'production'

let store = new Vuex.Store({
  strict: debug,
  state: state,
  getters: getters,
  mutations: mutations,
  actions: actions
})

store.commit('addRow')
store.commit('addColumn')
store.commit('addColumn')

export default store
