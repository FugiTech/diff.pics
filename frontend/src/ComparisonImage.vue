<template>
  <div class="image">
    <div>
      <div>
        <div v-if="src" class="control" :style="{ backgroundImage: srcBG }">
          <div><span @click.prevent="clear">&#x2716;</span></div>
          <input type="text" v-model="name" v-show="!batchName" />
        </div>
        <div v-else class="select" :class="{ hover }" @dragover.prevent="hover = true" @dragleave.prevent="hover = false" @dragend.prevent @drop.prevent="handleDrop">
          <strong>Drop Image Here</strong>
          <em>or</em>
          <label class="browse">Browse file...
            <input type="file" accept="image/*" @change.prevent="handleBrowse" />
          </label>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import VueModel from './store/model'
import sha1 from './sha1'

export default {
  name: 'ComparisonImage',
  props: ['row', 'column'],
  data: function () {
    return {
      hover: false
    }
  },
  computed: {
    batchName: VueModel('massNames', ':column'),
    name: VueModel('images', ':row', ':column', 'name'),
    src: VueModel('images', ':row', ':column', 'src'),
    sha1: VueModel('images', ':row', ':column', 'sha1'),
    file: VueModel('images', ':row', ':column', 'file'),
    srcBG: function () {
      return `url(${this.src})`
    }
  },
  methods: {
    handleDrop: function (e) {
      this.hover = false

      let data = e.dataTransfer
      let file = data.files && data.files[0]
      if (!file) {
        data.items.forEach((i) => {
          if (i.kind === 'file') file = i.getAsFile()
        })
      }
      if (file) {
        this.handleFile(file)
        return
      }
    },
    handleBrowse: function (e) {
      this.handleFile(e.target.files[0])
    },
    handleFile: function (file) {
      this.name = file.name.replace(/\.[^/.]+$/, '') || 'UNKNOWN'
      this.src = window.URL.createObjectURL(file)
      this.file = file
      sha1(file).then((hash) => {
        this.sha1 = hash
      })
    },
    clear: function () {
      this.name = ''
      this.src = ''
      this.file = null
      this.sha1 = ''
    }
  }
}
</script>

<style scoped>
.image {
  flex: auto;
  min-width: 178px;
  max-width: 178px;
  margin: 10px;
}
/* Stupid aspect-ratio hack */
.image > div {
  position: relative;
  height: 0;
  padding-bottom: 56.25%;
}
.image > div > div {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
}
.image > div > div > div {
  height: 100%;
}

.control {
  background-size: 100% 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.control div {
  flex: auto;
  text-align: right
}
.control div span {
  font-size: 2em;
  font-weight: bold;
  line-height: 1;
  color: #444;
}
.control div span:hover {
  color: #666;
  cursor: pointer;
}

.control input {
  background: #444;
  border: 0;
  margin: 5px;
  text-align: center;
}
.control input:hover {
  background: #666;
}

.select {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;

  border: 5px dashed #444;
  padding: 10px;
  text-align: center;
}
.select.hover {
  border: 5px dashed #666;
}

.select strong, .select label {
  color: #CCC;
}

.browse {
  border: 3px solid #444;
  padding: 5px 24px;
  font-weight: bold;
  font-size: 0.9em;
}
.browse:hover {
  border: 3px solid #666;
}
.browse input {
  display: none;
}
</style>
