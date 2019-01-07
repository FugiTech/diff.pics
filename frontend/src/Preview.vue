<template>
  <div class="preview-main">
    <h1>{{ title }}</h1>
    <div class="subtitle">
      <a href="#download" @click.prevent="download">DOWNLOAD</a> - 0 views
    </div>
    <div class="selector">
      <img v-for="(row, idx) in images" :src="row[0].src" @click.prevent="selected = idx; view = 0">
    </div>
    <div class="subselector" v-show="images[selected].length > 2">
      <span
        v-for="(img, idx) in images[selected]"
        @click.prevent="view = idx"
      >{{ label(idx+1) }}: {{ name(selected, idx) }}</span>
    </div>

    <div class="comparison">
      <h2>{{ name(selected, view) }}</h2>
      <img :src="images[selected][view].src" @mouseover="hover" @mouseout="fade">
    </div>
  </div>
</template>

<script>
import VueModel from "./store/model";

export default {
  name: "Preview",
  data: function() {
    return {
      selected: 0,
      view: 0
    };
  },
  computed: {
    title: function() {
      return this.$store.state.title || "Untitled";
    },
    massNames: VueModel("massNames"),
    images: VueModel("images")
  },
  methods: {
    label: function(n) {
      if (n > 9) return String.fromCharCode(55 + n);
      return n;
    },
    name: function(selected, view) {
      return this.massNames[view] || this.images[selected][view].name;
    },
    hover: function() {
      if (this.images[this.selected].length === 2) this.view = 1;
    },
    fade: function() {
      if (this.images[this.selected].length === 2) this.view = 0;
    },
    keypress: function(e) {
      let key = e.keyCode;
      let p = -1;

      if (key >= 49 && key <= 57) p = key - 49; // 1-9
      if (key >= 97 && key <= 105) p = key - 97; // 1-9 (keypad)
      if (key >= 65 && key <= 90) p = key - 55; // a-z (for 10+)
      if (key === 37 || key === 38) p = this.view - 1; // LEFT or UP
      if (key === 39 || key === 40) p = this.view + 1; // RIGHT or DOWN
      if (p < 0 || p >= this.images[this.selected].length) return;

      this.view = p;
    },
    download: function() {
      alert("Downloading is disabled in preview mode");
    }
  },
  mounted: function() {
    window.addEventListener("keydown", this.keypress);
  },
  beforeDestroy: function() {
    window.removeEventListener("keydown", this.keypress);
  }
};
</script>

<style scoped>
.preview-main {
  width: 100%;
  height: 100%;
  text-align: center;
}

h1 {
  margin-bottom: 0.1em;
}
.subtitle,
.subtitle a {
  color: #333;
  font-weight: bold;
  text-decoration: none;
}
.subtitle a:hover {
  color: #444;
}

.selector img {
  height: 60px;
  padding: 2px;
  margin: 0 5px;
}
.selector img:hover {
  border: 2px solid #999;
  padding: 0;
  cursor: pointer;
}

.subselector {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
}
.subselector span {
  display: block;
  border: 2px solid #444;
  color: #444;
  padding: 3px 8px;
  margin: 5px;
  font-weight: bold;
}
.subselector span:hover {
  border-color: #666;
  color: #666;
  cursor: pointer;
}

.comparison {
  display: inline-block;
  text-align: left;
  margin-top: 20px;
}
h2 {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
