import Vue from 'vue'
import VueI18n from 'vue-i18n'

import App from './App'
import store from './store'
import messages from './translations'

Vue.config.productionTip = false

Vue.use(VueI18n)

const i18n = new VueI18n({
  /* global LOCALE */
  locale: LOCALE, // Set by the prod build process
  fallbackLocale: 'en',
  messages
})

/* eslint-disable no-new */
new Vue({
  el: '#app',
  render: h => h(App),
  store,
  i18n
})
