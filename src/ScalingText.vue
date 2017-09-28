<template>
  <svg width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
    <text font-size="100vh" fill="currentColor" alignment-baseline="text-before-edge"><slot /></text>
  </svg>
</template>

<script>
export default {
  name: 'ScalingText',
  data: function () {
    return {
      interval: null
    }
  },
  mounted: function () {
    this.resize()
    this.interval = setInterval(this.resize.bind(this), 100)
  },
  beforeDestroy: function () {
    clearInterval(this.interval)
  },
  methods: {
    resize: function () {
      let svg = this.$el
      let text = svg.firstElementChild
      let bb = text.getBBox()
      svg.setAttribute('viewBox', `0 0 ${bb.width} ${bb.height}`)
    }
  }
}
</script>
