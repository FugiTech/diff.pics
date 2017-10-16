package main

import (
	"bytes"
	"html/template"
	"log"
	"net/http"
	"strconv"
	"strings"
)

func comparison(w http.ResponseWriter, r *http.Request) {
	p := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	locale, key := p[1], p[2]
	selected, _ := strconv.Atoi(p[3])
	if selected > 0 {
		selected--
	}

	d := &comparisonData{}

	var id int
	err := db.QueryRow("SELECT `id`, `key`, `title`, `zip`, `views` FROM `comparisons` WHERE `key` = ?", key).Scan(&id, &d.Key, &d.Title, &d.Zip, &d.Views)
	if err != nil {
		w.WriteHeader(404)
		log.Printf("No comparison found (locale=%s key=%s selected=%d): %v", locale, key, selected, err)
		return
	}

	d.Selected = selected
	d.Translations = translations["en"]
	if v, ok := translations[locale]; ok {
		d.Translations = v
	}

	rows, err := db.Query("SELECT `row`, `column`, `name`, `path`, `thumb`, `format` FROM `comparison_images` INNER JOIN `images` ON `image_id` = `images`.`id` WHERE `comparison_id` = ?", id)
	if err != nil {
		w.WriteHeader(404)
		log.Printf("No comparison images found (locale=%s key=%s selected=%d): %v", locale, key, selected, err)
		return
	}
	defer rows.Close()
	for rows.Next() {
		var row int
		var column int
		img := &image{}

		err = rows.Scan(&row, &column, &img.Name, &img.Path, &img.Thumb, &img.Format)
		if err != nil {
			w.WriteHeader(404)
			log.Printf("Read comparison image err (locale=%s key=%s selected=%d): %v", locale, key, selected, err)
			return
		}

		for i := row - len(d.Images); i >= 0; i-- {
			d.Images = append(d.Images, []*image{})
		}
		for i := column - len(d.Images[row]); i >= 0; i-- {
			d.Images[row] = append(d.Images[row], nil)
		}
		d.Images[row][column] = img
	}
	err = rows.Err()
	if err != nil {
		w.WriteHeader(404)
		log.Printf("Read comparison image err (locale=%s key=%s selected=%d): %v", locale, key, selected, err)
		return
	}

	buf := &bytes.Buffer{}
	err = comparisonTemplate.Execute(buf, d)
	if err != nil {
		w.WriteHeader(404)
		log.Printf("Template err (locale=%s key=%s selected=%d): %v", locale, key, selected, err)
		return
	}

	w.Write(buf.Bytes())
}

type comparisonData struct {
	Title        string
	Key          string
	Zip          string
	Images       [][]*image
	Selected     int
	Views        int
	Translations map[string]string
}

var comparisonTemplate = template.Must(template.New("comparisonTemplate").Funcs(template.FuncMap{
	"hydrate": func(d *comparisonData, k string) template.HTML {
		return template.HTML(strings.Replace(strings.Replace(strings.Replace(d.Translations[k], `{twitter}`, `<a href="https://twitter.com/fugiman">Twitter</a>`, -1), `{github}`, `<a href="https://github.com/Fugiman/diff.pics/issues">Github</a>`, -1), `{views}`, strconv.Itoa(d.Views), -1))
	},
	"incr": func(i int) int {
		return i + 1
	},
	"label": func(i int) string {
		if i < 10 {
			return strconv.Itoa(i)
		}
		return string([]byte{byte(i + 55)})
	},
}).Parse(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Diff.pics - {{ .Title }}</title>
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{{ .Title }}">
  <meta name="twitter:description" content="A diff.pics comparison">
  <meta name="twitter:image" content="https://static.diff.pics/images/{{ (index .Images .Selected 0).Path }}">
  <link rel="stylesheet" href="//fonts.googleapis.com/css?family=Open+Sans:400,300,700">
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
    }

    body {
      font-family: "Open Sans", sans-serif;
      color: white;
      background: black;
      text-align: center;
      margin: 0;
    }

    .feedback {
      font-size: 0.8em;
      text-align: right;
      color: #666;
      padding-right: 5px;
    }
    .feedback a {
      color: #999;
    }

    h1 {
      margin: 0.1em;
    }
    .subtitle, .subtitle a {
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

    span {
      display: inline-block;
      border: 2px solid #444;
      color: #444;
      padding: 3px 8px;
      margin: 5px;
      font-weight: bold;
    }
    span:hover {
      border-color: #666;
      color: #666;
      cursor: pointer;
    }
    input {
      display: none;
    }

    .comparison {
      display: none;
      text-align: left;
      margin-top: 20px;
    }
    h2 {
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

{{ if gt (len (index .Images .Selected)) 2 }}
{{ range $idx, $img := index .Images .Selected }}
  #comp-{{ incr $idx }}:checked ~ .comp-{{ incr $idx }} {
    display: inline-block;
  }
{{ end }}
{{ else }}
  .comp-1 { display: inline-block; }
  .comparisons:hover .comp-1 { display: none; }
  .comparisons:hover .comp-2 { display: inline-block; }
{{ end }}
  </style>
</head>
<body>
  <div class="feedback">{{ hydrate . "Feedback" }}</div>
  <h1>{{ .Title }}</h1>
  <div class="subtitle">
    <a href="/zips/{{ .Zip }}" download="{{ .Title }}.zip">{{ .Translations.Download }}</a>
    -
    {{ hydrate . "Views" }}
  </div>
{{ if gt (len .Images) 1 }}
  <div class="selector">
{{ range $idx, $row := .Images }}
    <a href="/{{ $.Key }}/{{ incr $idx }}"><img src="/thumbs/{{ (index $row 0).Thumb }}"></a>
{{ end }}
  </div>
{{ end }}

{{ if gt (len (index .Images .Selected)) 2 }}
{{ range $idx, $img := index .Images .Selected }}
  <label for="comp-{{ incr $idx }}"><span>{{ label (incr $idx) }}: {{ $img.Name }}</span></label><input type="radio" name="img" id="comp-{{ incr $idx }}"{{ if eq $idx 0 }} checked{{ end }}>
{{ end }}
{{ end }}

{{ if le (len (index .Images .Selected)) 2 }}
<div class="comparisons">
{{ end }}
{{ range $idx, $img := index .Images .Selected }}
  <div class="comparison comp-{{ incr $idx }}">
    <h2>{{ $img.Name }}</h2>
    <img src="/images/{{ $img.Path }}" />
  </div>
{{ end }}
{{ if le (len (index .Images .Selected)) 2 }}
</div>
{{ end }}

{{ if gt (len (index .Images .Selected)) 2 }}
  <script>
    window.addEventListener('keydown', function (e) {
      let key = e.keyCode
      let p = -1
      let selected = document.querySelector('input[name="img"]:checked').id.substr(5) * 1

      if (key >= 49 && key <= 57) p = key - 48 // 1-9
      if (key >= 97 && key <= 105) p = key - 96 // 1-9 (keypad)
      if (key >= 65 && key <= 90) p = key - 55 // a-z (for 10+)
      if (key === 37 || key === 38) p = selected - 1 // LEFT or UP
      if (key === 39 || key === 40) p = selected + 1 // RIGHT or DOWN

      let el = document.getElementById('comp-'+p)
      if (el) {
        el.checked = true
        e.preventDefault()
      }
    })
  </script>
{{ end }}

  <img src="https://api.diff.pics/ping?key={{ .Key }}" />
</body>
</html>
`))
