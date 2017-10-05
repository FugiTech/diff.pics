package main

import (
	"encoding/base64"
	"net/http"
)

var imageData []byte

func init() {
	imageData, _ = base64.StdEncoding.DecodeString("R0lGODlhAQABAIABAP///wAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==")
}

func ping(w http.ResponseWriter, r *http.Request) {
	db.Exec("UPDATE `comparisons` SET `views` = `views` + 1 WHERE `key` = ?", r.FormValue("key"))
	w.Header().Set("Content-Type", "image/gif")
	w.Write(imageData)
}
