package main

import (
	"io/ioutil"
	"log"
	"path"
	"strings"

	yaml "gopkg.in/yaml.v2"
)

var translations = map[string]map[string]string{}

func init() {
	dir, err := ioutil.ReadDir("translations")
	if err != nil {
		log.Fatal(`ioutil.ReadDir("translations"):`, err)
	}
	for _, file := range dir {
		name := file.Name()
		name = strings.TrimSuffix(name, path.Ext(name))
		data, err := ioutil.ReadFile(path.Join("translations", file.Name()))
		if err != nil {
			log.Fatal(`ioutil.ReadFile("translations/`+file.Name()+`"):`, err)
		}

		translations[name] = map[string]string{}
		m := map[interface{}]interface{}{}
		err = yaml.Unmarshal(data, m)
		if err != nil {
			log.Fatal(`yaml.Unmarshal("translations/`+file.Name()+`"):`, err)
		}

		var decodeTranslations func(map[interface{}]interface{}, string)
		decodeTranslations = func(m map[interface{}]interface{}, prefix string) {
			for k, v := range m {
				k := k.(string)
				switch v := v.(type) {
				case string:
					translations[name][prefix+k] = v
				case map[interface{}]interface{}:
					decodeTranslations(v, prefix+k+".")
				default:
					log.Fatalf("Unable to decode translation key: %q %q %q %T", name, prefix, k, v)
				}
			}
		}
		decodeTranslations(m, "")
	}
}
