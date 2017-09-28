package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	_ "net/http/pprof"
	"os"
	"regexp"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3/s3manager"
	_ "github.com/go-sql-driver/mysql"
)

var db *sql.DB

var awsAccessKey = os.Getenv("AWS_ACCESS_KEY")
var awsSecretAccessKey = os.Getenv("AWS_SECRET_ACCESS_KEY")
var awsRegion = "us-east-1"

var awsSession = session.Must(session.NewSession(&aws.Config{Region: aws.String(awsRegion)}))
var downloader = s3manager.NewDownloader(awsSession)
var uploader = s3manager.NewUploader(awsSession)

var hashRe = regexp.MustCompile(`^[0-9A-F]{40}$`)

func main() {
	var err error
	db, err = sql.Open("mysql", os.Getenv("MYSQL")+"diff.pics?parseTime=true")
	if err != nil {
		log.Print("sql.Open:", err)
		return
	}

	go func() { log.Println("fullBuild:", fullBuild()) }()
	http.HandleFunc("/check_images", h(check_images))
	http.HandleFunc("/create_comparison", h(create_comparison))
	log.Println(http.ListenAndServe("127.0.0.1:9999", nil))
}

func h(fn func(*http.Request) (interface{}, error)) func(http.ResponseWriter, *http.Request) {
	writeJSON := func(w http.ResponseWriter, status int, data interface{}) {
		body, err := json.Marshal(data)
		if err != nil {
			w.WriteHeader(500)
			return
		}
		w.WriteHeader(status)
		w.Write(body)
	}
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		resp, err := fn(r)
		if err != nil {
			writeJSON(w, 400, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, 200, resp)
	}
}
