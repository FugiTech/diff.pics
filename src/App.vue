<template>
  <div class="app" @dragover.prevent="onDrag">
    <i18n path="Feedback" tag="div" class="feedback">
      <a place="github" href="https://github.com/Fugiman/diff.pics/issues">Github</a>
      <a place="twitter" href="https://twitter.com/fugiman">Twitter</a>
    </i18n>

    <input class="title" type="text" :placeholder="$t('ComparisonTitle')" v-model="title" />

    <div class="mass-rename">
      <strong>{{ $t('MassRename') }}</strong>
      <div>
        <MassRename v-for="c in columns" :column="c-1" />
      </div>
    </div>

    <div v-if="false">
      <strong>Batch Move</strong>
      <span class="batch-move" v-for="c in columns">
        Column {{ c }}
      </span>
    </div>

    <draggable v-model="images">
      <div class="row" v-for="r in rows">
        <div class="info">
          <div class="number"><ScalingText>{{ r }}</ScalingText></div>
          <div class="remove" @click="removeRow(r-1)"><ScalingText>{{ $t('RemoveRow') }}</ScalingText></div>
        </div>
        <ComparisonImages :row="r-1" />
      </div>
    </draggable>

    <div class="control">
      <div @click.prevent="addRow">{{ $t('AddRow') }}</div>
      <div @click.prevent="addColumn">{{ $t('AddColumn') }}</div>
      <div @click.prevent="removeColumn">{{ $t('RemoveColumn') }}</div>
    </div>

    <div class="actions">
      <div class="show-preview" @click.prevent="maybeShowPreview"><ScalingText>{{ $t('Preview') }}</ScalingText></div>
      <div class="submit" @click.prevent="submit"><ScalingText>{{ $t('Submit') }}</ScalingText></div>
    </div>

    <div class="hint">{{ $t('Hint') }}</div>

    <div class="preview" v-if="preview">
      <div class="close-preview" @click.prevent="preview = false">&#x2716;</div>
      <Preview />
    </div>

    <div class="magic" v-show="magic" @drop.prevent="onDrop" @dragleave.prevent="magic = false" @dragend.prevent>
      <span>{{ $t('Magic') }}</span>
    </div>

    <div class="loading" v-show="loading">
      <div><LoadingSpinner /></div>
    </div>

    <div class="error" v-show="error">
      <h1>{{ $t('Error.Title') }}</h1>
      <span>{{ error }}</span>
      <div class="ok" @click.prevent="error = ''">{{ $t('Error.OK') }}</div>
    </div>
  </div>
</template>

<script>
import { mapGetters, mapMutations } from 'vuex'
import draggable from 'vuedraggable'
import VueModel from './store/model'
import sha1 from './sha1'
import MassImageCompare from './MassImageCompare'

import ScalingText from './ScalingText'
import MassRename from './MassRename'
import ComparisonImages from './ComparisonImages'
import LoadingSpinner from './LoadingSpinner'
import Preview from './Preview'

export default {
  name: 'app',
  components: {
    draggable,
    ScalingText,
    MassRename,
    ComparisonImages,
    LoadingSpinner,
    Preview
  },
  data: function () {
    return {
      preview: false,
      magic: false,
      loading: false,
      error: ''
    }
  },
  computed: {
    title: VueModel('title'),
    images: VueModel('images'),
    massNames: VueModel('massNames'),
    ...mapGetters([
      'rows',
      'columns'
    ])
  },
  methods: {
    ...mapMutations([
      'addRow',
      'removeRow',
      'addColumn',
      'removeColumn'
    ]),
    maybeShowPreview: function () {
      // Ensure all images are set
      for (let i = 0; i < this.images.length; i++) {
        for (let j = 0; j < this.images[i].length; j++) {
          if (this.images[i][j].file === null) {
            this.error = this.$t('Error.Missing')
            return
          }
        }
      }
      this.preview = true
    },
    submit: function () {
      let files = {}
      for (let i = 0; i < this.images.length; i++) {
        for (let j = 0; j < this.images[i].length; j++) {
          let img = this.images[i][j]
          // Ensure all images are set
          if (img.file === null) {
            this.error = this.$t('Error.Missing')
            return
          }

          // Build a map of sha -> file
          files[img.sha1] = img.file
        }
      }

      // Check which files need to be uploaded
      this.loading = true
      fetch(process.env.API + '/check_images', {method: 'POST', body: JSON.stringify(Object.keys(files))}).then((response) => {
        return response.json()
      }).then((toUpload) => {
        return Promise.all(Object.entries(toUpload).map((d) => {
          let k = d[0]
          let v = d[1]
          let f = files[k]
          let data = new FormData()
          data.append('key', v.Key)
          data.append('content-type', f.type)
          data.append('x-amz-algorithm', 'AWS4-HMAC-SHA256')
          data.append('x-amz-credential', v.Credential)
          data.append('x-amz-date', v.Date)
          data.append('policy', v.Policy)
          data.append('x-amz-signature', v.Signature)
          data.append('file', f)

          console.log(v.URL, data)
          return fetch(v.URL, {method: 'POST', body: data}).then((response) => {
            if (!response.ok) throw new Error('Failed to upload image')
          })
        }))
      }).then(() => {
        let data = {title: this.title || 'Untitled', images: []}
        for (let r = 0; r < this.images.length; r++) {
          let row = []
          for (let c = 0; c < this.images[r].length; c++) {
            row.push({
              name: this.massNames[c] || this.images[r][c].name,
              sha: this.images[r][c].sha1
            })
          }
          data.images.push(row)
        }
        return fetch(process.env.API + '/create_comparison', {method: 'POST', body: JSON.stringify(data)})
      }).then((response) => {
        return response.json()
      }).then((data) => {
        alert(data.URL)
      }).then(null, (e) => {
        console.error(e)
        this.error = e.message
      }).then(() => {
        this.loading = false
      })
    },
    onDrag: function (e) {
      // Browser hacks to figure out how many items they want to drop
      var data = e.dataTransfer
      var count = data.mozItemCount || data.items.length
      this.magic = count > 1 && data.types.includes('Files')
    },
    onDrop: function (e) {
      this.magic = false
      this.loading = true
      let files = e.dataTransfer.files
      let shaPromises = []
      for (let i = 0; i < files.length; i++) {
        shaPromises.push(sha1(files[i]))
      }
      Promise.all([MassImageCompare(files), Promise.all(shaPromises)]).then((data) => {
        let comparisons = data[0]
        let shas = data[1]
        let used = {}
        let images = []

        let makeImage = (i) => {
          return {
            name: files[i].name.replace(/\.[^/.]+$/, '') || 'UNKNOWN',
            src: window.URL.createObjectURL(files[i]),
            file: files[i],
            sha1: shas[i]
          }
        }

        // Find similar images and build a new images array out of the results
        for (let i = 0; i < comparisons.length; i++) {
          let d = comparisons[i]
          if (d.p >= 50) continue // Images are too different and shouldn't be put together

          if (used[d.a] !== undefined && used[d.b] !== undefined) {
            if (used[d.a] !== used[d.b]) {
              console.error('oh no')
            }
          } else if (used[d.a] !== undefined) {
            images[used[d.a]].push(makeImage(d.b))
            used[d.b] = used[d.a]
          } else if (used[d.b] !== undefined) {
            images[used[d.b]].push(makeImage(d.a))
            used[d.a] = used[d.b]
          } else {
            used[d.a] = used[d.b] = images.length
            images.push([makeImage(d.a), makeImage(d.b)])
          }
        }

        // Reset massNames and validate that all our rows are the same length
        let columns = []
        for (let i = 0; i < images[0].length; i++) columns.push('')
        for (let i = 1; i < images.length; i++) {
          if (images[i].length !== columns.length) {
            console.log('oh no p2')
          }
        }

        // Set each massName to the common prefix of each column
        if (images.length >= 2) {
          columns = columns.map((name, col) => { // Use map so that we can easily return from nested loops
            for (let char = 0; char < images[0][col].name.length; char++) {
              let c = images[0][col].name[char]
              for (let row = 1; row < images.length; row++) {
                let cc = images[row][col].name[char]
                if (c !== cc) {
                  return name.trim()
                }
              }
              name += c
            }
            return name.trim()
          })
        }

        this.massNames = columns
        this.images = images
        this.loading = false
      })
    }
  }
}
</script>

<style>
*, *::before, *::after {
  box-sizing: border-box;
}

html, body {
  margin: 0;
  height: 100%;
  color: #666;
  background: black;
}

input {
  font-family: inherit;
  color: white;
  background: inherit;
}
</style>

<style scoped>
.app {
  position: relative;
  font-family: "Open Sans", sans-serif;
  margin: auto;
  max-width: 960px;
  width: 100%;
  height: 100%;
}

.feedback {
  font-size: 0.8em;
  text-align: right;
}
.feedback a {
  color: #999;
}

.title {
  width: 100%;
  margin-bottom: 20px;
  text-align: center;
  font-size: 40px;
  outline: none;
  border: none;
}

.mass-rename {
  display: flex;
}
.mass-rename > strong {
  flex: none;
}
.mass-rename > div {
  flex: auto;
  flex-wrap: wrap;
}
.mass-rename > div > input {
  width: calc(25% - 10px);
  margin-left: 10px;
  margin-bottom: 5px;
}

.row {
  display: flex;
}

.info {
  flex: 0 50 50px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 5px;
}

.remove {
  color: #444;
}
.remove:hover {
  color: #666;
  cursor: pointer;
}

.control {
  display: flex;
  justify-content: center;
}
.control > div {
  margin: 5px 10px;
  padding: 5px 20px;
  border: 2px solid #444;
  color: #444;
  font-weight: bold;
}
.control > div:hover {
  border-color: #666;
  color: #666;
  cursor: pointer;
}

.actions {
  display: flex;
  justify-content: center;
}
.actions > div {
  margin: 10px 20px;
  padding: 5px 30px;
  font-weight: bold;
  max-width: 400px;
}

.show-preview {
  border: 4px solid #444;
  color: #444;
}
.show-preview:hover {
  border: 4px solid #666;
  color: #666;
  cursor: pointer;
}

.submit {
  background: #999;
  color: black;
}
.submit:hover {
  background: #CCC;
  cursor: pointer;
}

.hint {
  text-align: center;
  font-size: 0.9em;
  font-style: italic;
}

.preview, .magic, .loading, .error {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;

  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;

  background: rgba(0,0,0,0.7);
  color: white;
}
.magic > *, .error > * {
  max-width: 960px;
}
.loading > * {
  display: flex;
  justify-content: center;
  width: 960px;
}
.magic, .error {
  font-size: 2em;
}

.preview {
  background: rgba(0,0,0,0.95);
}
.close-preview {
  position: absolute;
  top: -5px;
  right: 5px;
  color: #444;
  font-size: 2em;
}
.close-preview:hover {
  color: #666;
  cursor: pointer;
}

.error h1 {
  margin: 0;
}

.error .ok {
  margin: 20px;
  padding: 5px 30px;
  border: 2px solid #CCC;
  color: #CCC;
}
.error .ok:hover {
  border-color: #FFF;
  color: #FFF;
  cursor: pointer;
}
</style>
