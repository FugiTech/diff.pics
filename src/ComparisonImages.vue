<template>
  <draggable class="images" v-model="images" :move="onMove" @end="onEnd" :options="{ group: 'images' }">
    <ComparisonImage v-for="(_, c) in images" :row="row" :column="c" :style="style" />
  </draggable>
</template>

<script>
import { mapGetters } from 'vuex'
import draggable from 'vuedraggable'
import VueModel from './store/model'
import ComparisonImage from './ComparisonImage'

export default {
  name: 'ComparisonImages',
  props: ['row'],
  components: {
    draggable,
    ComparisonImage
  },
  data: function () {
    return {
      revert: null,
      moveData: null
    }
  },
  computed: {
    images: VueModel('images', ':row'),
    ...mapGetters([
      'columns'
    ]),
    maxWidth: function () {
      if (this.columns <= 2) return '356px'
      if (this.columns === 3) return '267px'
      return '178px'
    },
    style: function () {
      return {
        maxWidth: this.maxWidth,
        marginLeft: this.columns <= 4 ? 'auto' : ''
      }
    }
  },
  methods: {
    onMove: function (evt, e) {
      if (this.revert) this.revert()
      this.revert = null

      let rctx = evt.relatedContext
      if (rctx.list && rctx.list !== this.images) {
        // Make the illusion of swapping the element without affecting the lists
        let el = evt.related
        let copy = el.cloneNode(true)
        el.style.display = 'none'
        evt.from.insertBefore(copy, evt.from.children[evt.draggedContext.index])
        this.revert = () => {
          el.style.display = ''
          evt.from.removeChild(copy)
        }

        // Save data so we can adjust the list later
        this.moveData = {
          from: {
            row: rctx.component.$parent.row,
            column: evt.draggedContext.futureIndex - 1
          },
          to: {
            row: this.row,
            column: evt.draggedContext.index
          }
        }
      }
    },
    onEnd: function () {
      if (this.revert) {
        this.revert()
        console.log(JSON.stringify(this.moveData))
        this.$store.commit('moveImage', this.moveData)
      }
      this.revert = null
    }
  }
}
</script>

<style scoped>
.images {
  flex: 1 900 900px;
  display: flex;
  flex-wrap: wrap;
  align-content: space-around;
  align-items: center;
}
</style>
