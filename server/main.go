package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net"
	"net/http"
	_ "net/http/pprof"
	"os"
	"os/signal"
	"regexp"
	"syscall"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3/s3manager"
	_ "github.com/go-sql-driver/mysql"
)

var db *sql.DB

var awsAccessKey = os.Getenv("AWS_ACCESS_KEY_ID")
var awsSecretAccessKey = os.Getenv("AWS_SECRET_ACCESS_KEY")
var awsRegion = "us-east-1"

var awsSession = session.Must(session.NewSession(&aws.Config{Region: aws.String(awsRegion)}))
var downloader = s3manager.NewDownloader(awsSession)
var uploader = s3manager.NewUploader(awsSession)

var hashRe = regexp.MustCompile(`^[0-9A-F]{40}$`)

func main() {
	http.HandleFunc("/check_images", h(check_images))
	http.HandleFunc("/create_comparison", h(create_comparison))
	http.HandleFunc("/ping", ping)
	http.HandleFunc("/comparison/", comparison)

	var (
		l   net.Listener
		err error
	)
	if os.Getenv("SOCKPATH") != "" {
		l, err = net.Listen("unix", os.Getenv("SOCKPATH"))
	} else {
		l, err = net.Listen("tcp", "127.0.0.1:9999")
	}
	if err != nil {
		log.Print("net.Listen:", err)
		return
	}
	defer l.Close()

	db, err = sql.Open("mysql", os.Getenv("MYSQL")+"diff.pics?parseTime=true")
	if err != nil {
		log.Print("sql.Open:", err)
		return
	}

	shutdown := make(chan struct{})
	go func() {
		if err := http.Serve(l, nil); err != nil {
			log.Println("http.Serve:", err)
		}
		shutdown <- struct{}{}
	}()

	// Wait for either a signal or our server to stop
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, os.Kill, syscall.SIGTERM)
	select {
	case <-c:
	case <-shutdown:
	}
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
