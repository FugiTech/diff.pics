<template>
  <input type="text" v-model="name" />
</template>

<script>
import VueModel from './store/model'

export default {
  name: 'MassRename',
  props: ['column'],
  computed: {
    name: VueModel('massNames', ':column')
  }
}
</script>

<style scoped>
input {
  outline: 0;
  border: 0;
  background: #444;
}
input:hover {
  background: #666;
}
</style>
