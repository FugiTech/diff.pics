package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/s3"

	"golang.org/x/net/context/ctxhttp"
	"golang.org/x/sync/errgroup"
)

const SiteID = "static.diff.pics"

var AccessToken = os.Getenv("NETLIFY_ACCESS_TOKEN")

const MaxRetries = 3
const MaxConcurrentUploads = 20

var buildState = struct {
	Mutex   sync.Mutex
	Running bool
	Current []chan error
	Waiting []chan error
}{}

func fullBuild() (rerr error) {
	// If a build is running, join a group waiting for it to finish
	// Otherwise just keep going, then let everyone listening know the result
	buildState.Mutex.Lock()
	if buildState.Running {
		ch := make(chan error, 1)
		buildState.Waiting = append(buildState.Waiting, ch)
		buildState.Mutex.Unlock()
		return <-ch
	}
	buildState.Running = true
	buildState.Mutex.Unlock()
	defer func() {
		buildState.Mutex.Lock()
		defer buildState.Mutex.Unlock()
		buildState.Running = false
		for _, ch := range buildState.Current {
			ch <- rerr
		}
		buildState.Current = buildState.Waiting
		buildState.Waiting = nil
		if len(buildState.Current) > 0 {
			go fullBuild()
		}
	}()

	// Track files & hashes for deployment
	hashes := map[string]string{}
	rhashes := map[string][]string{}

	// Add images from database
	rows, err := db.Query("SELECT `path`, `thumb` FROM `images`")
	if err != nil {
		return fmt.Errorf("Invalid SQL: %v", err)
	}
	defer rows.Close()
	for rows.Next() {
		var (
			path  string
			thumb string
		)
		err = rows.Scan(&path, &thumb)
		if err != nil {
			return fmt.Errorf("Invalid SQL: %v", err)
		}

		pathHash := strings.ToLower(strings.Replace(path, "/", "", -1))
		hashes["images/"+path] = pathHash
		rhashes[pathHash] = append(rhashes[pathHash], "images/"+path)

		thumbHash := strings.ToLower(strings.Replace(thumb, "/", "", -1))
		hashes["thumbs/"+thumb] = thumbHash
		rhashes[thumbHash] = append(rhashes[thumbHash], "thumbs/"+thumb)
	}
	err = rows.Err()
	if err != nil {
		return fmt.Errorf("Invalid SQL: %v", err)
	}

	// Create deploy
	body, err := json.Marshal(map[string]interface{}{"files": hashes, "async": true})
	if err != nil {
		return err
	}
	resp, err := http.Post("https://api.netlify.com/api/v1/sites/"+SiteID+"/deploys?access_token="+AccessToken, "application/json", bytes.NewReader(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, err = ioutil.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	digest := &struct {
		DeployID     string   `json:"id"`
		State        string   `json:"state"`
		Required     []string `json:"required"`
		ErrorMessage string   `json:"error_message"`
	}{}
	err = json.Unmarshal(body, &digest)
	if err != nil {
		return err
	}
	log.Println("Deploying:", digest.DeployID)

	// Wait for deploy to get ready/prepared
	start := time.Now()
	for digest.State != "prepared" && digest.State != "ready" {
		// Check for errors in preproccessing
		if digest.State == "error" {
			return fmt.Errorf("Preproccessing deploy failed: %s", digest.ErrorMessage)
		}

		// Wait between checks
		time.Sleep(2 * time.Second)
		if time.Now().After(start.Add(10 * time.Minute)) {
			return fmt.Errorf("Timeout waiting for deploy to be prepared")
		}

		// Actually check if it's ready
		resp, err := http.Get("https://api.netlify.com/api/v1/deploys/" + digest.DeployID + "?access_token=" + AccessToken)
		if err != nil {
			return err
		}
		defer resp.Body.Close()
		body, err = ioutil.ReadAll(resp.Body)
		if err != nil {
			return err
		}
		err = json.Unmarshal(body, &digest)
		if err != nil {
			return err
		}
	}
	log.Printf("Ready to deploy %d files. God have mercy on our souls.", len(digest.Required))

	// Upload individual files
	sem := make(chan struct{}, MaxConcurrentUploads)
	eg, ctx := errgroup.WithContext(context.Background())
	for _, required := range digest.Required {
		for _, file := range rhashes[required] {
			file := file
			eg.Go(func() error {
				<-sem
				defer func() { sem <- struct{}{} }()

				var err error
				url := fmt.Sprintf("https://api.netlify.com/api/v1/deploys/%s/files/%s", digest.DeployID, file)

				buf := aws.NewWriteAtBuffer([]byte{})
				_, err = downloader.DownloadWithContext(ctx, buf, &s3.GetObjectInput{
					Bucket: aws.String("diff.pics"),
					Key:    aws.String(file),
				})
				if err != nil {
					log.Println("Could not download from s3:", file, err)
					return fmt.Errorf("Could not download from s3: %s: %v", file, err)
				}
				uploadData := buf.Bytes()

				for i := 0; i < MaxRetries; i++ {
					req, _ := http.NewRequest("PUT", url, bytes.NewReader(uploadData))
					req.ContentLength = int64(len(uploadData))
					req.Header.Add("Authorization", "Bearer "+AccessToken)
					req.Header.Add("Content-Type", "application/octet-stream")

					var resp *http.Response
					resp, err = ctxhttp.Do(ctx, nil, req)
					if err != nil {
						log.Printf("Retrying %s: err=%v\n", file, err)
						time.Sleep(2 * time.Second)
						continue
					}
					defer resp.Body.Close()

					if resp.StatusCode == 429 {
						reset, err := strconv.Atoi(resp.Header.Get("X-RateLimit-Reset"))
						if err == nil {
							time.Sleep(time.Unix(int64(reset), 0).Sub(time.Now()))
							i--
							continue
						} else {
							log.Printf("Wat? Error decoding 429 reset: %s: %v", resp.Header.Get("X-RateLimit-Reset"), err)
						}
					}

					if resp.StatusCode >= 400 {
						status := 0
						if resp != nil {
							status = resp.StatusCode
						}
						err = fmt.Errorf("status=%d", status)
						log.Printf("Retrying %s: status=%d\n", file, status, err)
						time.Sleep(2 * time.Second)
						continue
					}

					return nil
				}

				if err != nil {
					log.Println("Upload Failed:", file, err)
				}
				return err
			})
		}
	}
	for i := 0; i < MaxConcurrentUploads; i++ {
		sem <- struct{}{}
	}
	if err := eg.Wait(); err != nil {
		return err
	}

	// Wait for deploy to be ready (ready means deployed)
	start = time.Now()
	for digest.State != "ready" {
		// Check for errors in preproccessing
		if digest.State == "error" {
			return fmt.Errorf("Postproccessing deploy failed: %s", digest.ErrorMessage)
		}

		// Wait between checks
		time.Sleep(2 * time.Second)
		if time.Now().After(start.Add(10 * time.Minute)) {
			return fmt.Errorf("Timeout waiting for deploy to be ready")
		}

		// Actually check if it's ready
		resp, err := http.Get("https://api.netlify.com/api/v1/deploys/" + digest.DeployID + "?access_token=" + AccessToken)
		if err != nil {
			return err
		}
		defer resp.Body.Close()
		body, err = ioutil.ReadAll(resp.Body)
		if err != nil {
			return err
		}
		err = json.Unmarshal(body, &digest)
		if err != nil {
			return err
		}
	}

	return nil
}
