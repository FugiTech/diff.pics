package main

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha1"
	"database/sql"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"math"
	"math/rand"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/aws/aws-sdk-go/service/s3/s3manager"
	"github.com/pkg/errors"
	"golang.org/x/sync/errgroup"
)

var NetlifyHookURL = os.Getenv("NETLIFY_DEPLOY_HOOK")

func create_comparison(r *http.Request) (interface{}, error) {
	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		return nil, fmt.Errorf("Could not read request body")
	}

	params := &struct {
		Title  string
		Images [][]*image
	}{}
	err = json.Unmarshal(body, &params)
	if err != nil {
		return nil, fmt.Errorf("Could not decode request body")
	}

	// Step 1: Decode & sanitize the request
	images := map[string][]*image{}
	paths := []interface{}{}
	for _, row := range params.Images {
		names := map[string]struct{}{}
		for _, img := range row {
			if _, ok := names[img.Name]; ok {
				return nil, fmt.Errorf("Duplicate Name")
			}
			if !hashRe.MatchString(img.Sha) {
				return nil, fmt.Errorf("Invalid hash: %v", img.Sha)
			}

			img.Path = fmt.Sprintf("%s/%s/%s", img.Sha[0:2], img.Sha[2:4], img.Sha[4:])
			names[img.Name] = struct{}{}
			images[img.Path] = append(images[img.Path], img)
			paths = append(paths, img.Path)
		}
	}
	if len(paths) == 0 {
		return nil, fmt.Errorf("No images to compare")
	}

	// Step 2: Look up all the images we're comparing
	rows, err := db.Query(fmt.Sprintf("SELECT `id`, `path`, `thumb`, `format` FROM `images` WHERE `path` IN (?%s)", strings.Repeat(",?", len(paths)-1)), paths...)
	if err != nil {
		return nil, fmt.Errorf("Invalid SQL: %v", err)
	}
	defer rows.Close()
	for rows.Next() {
		var (
			id     string
			path   string
			thumb  string
			format string
		)
		err = rows.Scan(&id, &path, &thumb, &format)
		if err != nil {
			return nil, fmt.Errorf("Invalid SQL: %v", err)
		}
		for _, img := range images[path] {
			img.ID = id
			img.Thumb = thumb
			img.Format = format
		}
	}
	err = rows.Err()
	if err != nil {
		return nil, fmt.Errorf("Invalid SQL: %v", err)
	}

	// Step 3: Wait for images to finish processing if they're not done yet (they should be)
	time.Sleep(10 * time.Second) // TODO: use webhooks for this detection, should speed things up by 10 seconds and make it more reliable

	// Step 4: Download all the images (to make the ZIP file)
	eg, ctx := errgroup.WithContext(context.Background())
	for _, row := range params.Images {
		for _, img := range row {
			img := img
			eg.Go(func() error {
				buf := aws.NewWriteAtBuffer([]byte{})
				_, err := downloader.DownloadWithContext(ctx, buf, &s3.GetObjectInput{
					Bucket: aws.String("diff.pics"),
					Key:    aws.String("images/" + img.Path),
				})
				img.Data = buf.Bytes()
				return errors.Wrap(err, img.Path)
			})
		}
	}
	if err := eg.Wait(); err != nil {
		return nil, fmt.Errorf("Failed to download images: %v", err)
	}

	// Step 5: Make the zip file
	buf := &bytes.Buffer{}
	zw := zip.NewWriter(buf)
	for i, row := range params.Images {
		for _, img := range row {
			f, err := zw.Create(fmt.Sprintf("%d/%s.%s", i, img.Name, img.Format))
			if err != nil {
				return nil, fmt.Errorf("Failed to create zip file: %v", err)
			}
			_, err = f.Write(img.Data)
			if err != nil {
				return nil, fmt.Errorf("Failed to create zip file: %v", err)
			}
		}
	}
	err = zw.Close()
	if err != nil {
		return nil, fmt.Errorf("Failed to create zip file: %v", err)
	}

	// Step 6: Upload the zip file
	zipName := fmt.Sprintf("%X", sha1.Sum(buf.Bytes()))
	zipName = fmt.Sprintf("%s/%s/%s", zipName[0:2], zipName[2:4], zipName[4:])
	_, err = uploader.Upload(&s3manager.UploadInput{
		Bucket: aws.String("diff.pics"),
		Key:    aws.String("zips/" + zipName),
		Body:   buf,
	})
	if err != nil {
		return nil, fmt.Errorf("Failed to upload zip file: %v", err)
	}

	// Step 7: Find a key for the comparison
	var key string
	for keyLen := 12; keyLen <= 51; keyLen++ {
		key = randString(keyLen)

		var _ignore string
		err = db.QueryRow("SELECT `id` FROM `comparisons` WHERE `key` = ?", key).Scan(&_ignore)
		if err == sql.ErrNoRows {
			break
		}
	}
	if len(key) > 50 {
		return nil, fmt.Errorf("Couldn't generate key")
	}

	// Step 8: Add comparison to the database
	result, err := db.Exec("INSERT INTO `comparisons`(`key`, `title`, `zip`) VALUES(?,?,?)", key, params.Title, zipName)
	if err != nil {
		return nil, fmt.Errorf("Failed to insert comparison: %v", err)
	}
	comparisonID, err := result.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("Failed to fetch comparison id: %v", err)
	}

	// Step 9: Add images to the database
	numImages := 0
	args := []interface{}{}
	for r, row := range params.Images {
		for c, img := range row {
			numImages++
			args = append(args, comparisonID, r, c, img.ID, img.Name)
		}
	}
	rowTemplate := "(?,?,?,?,?)"
	_, err = db.Exec(fmt.Sprintf("INSERT INTO `comparison_images`(`comparison_id`, `row`, `column`, `image_id`, `name`) VALUES %s%s", rowTemplate, strings.Repeat(","+rowTemplate, numImages-1)), args...)
	if err != nil {
		return nil, fmt.Errorf("Failed to insert comparison images: %v", err)
	}

	// Step 10: Run a full build
	for {
		if _, err := http.Post(NetlifyHookURL, "", nil); err == nil {
			break
		}
	}
	var deployID string
	for {
		time.Sleep(2 * time.Second)
		resp, err := http.Get("https://api.netlify.com/api/v1/sites/diff.pics/deploys?access_token=" + AccessToken)
		if err != nil {
			continue
		}
		defer resp.Body.Close()
		body, err = ioutil.ReadAll(resp.Body)
		if err != nil {
			continue
		}
		deployResp := []struct {
			DeployID string `json:"id"`
		}{}
		err = json.Unmarshal(body, &deployResp)
		if err != nil {
			continue
		}

		deployID = deployResp[0].DeployID
		break
	}
	for {
		if err = fullBuild(); err == nil {
			break
		}
	}

	digest := &struct {
		State        string `json:"state"`
		ErrorMessage string `json:"error_message"`
	}{}
	for digest.State != "prepared" && digest.State != "ready" {
		// Check for errors in preproccessing
		if digest.State == "error" {
			return nil, fmt.Errorf("Deploy failed: %s -- Your comparison will eventually be at https://diff.pics/%s/1", digest.ErrorMessage, key)
		}
		time.Sleep(2 * time.Second)
		resp, err := http.Get("https://api.netlify.com/api/v1/deploys/" + deployID + "?access_token=" + AccessToken)
		if err != nil {
			continue
		}
		defer resp.Body.Close()
		body, err = ioutil.ReadAll(resp.Body)
		if err != nil {
			continue
		}
		err = json.Unmarshal(body, &digest)
		if err != nil {
			continue
		}
	}

	// Step 11: return the url to go to
	return map[string]string{"URL": fmt.Sprintf("/%s/1", key)}, nil
}

type image struct {
	Name string
	Sha  string

	ID     string
	Path   string
	Thumb  string
	Format string

	Data []byte
}

const randStringChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-"

func init() {
	rand.Seed(time.Now().UnixNano())
}
func randString(length int) string {
	b := make([]byte, length)

	numBytes := int(1 + math.Log2(float64(len(randStringChars)-1)))
	mask := int64(1<<uint(numBytes) - 1)
	charsPerRand := 63 / numBytes

	for i := 0; i < length; i += charsPerRand {
		for j, r := 0, rand.Int63(); j < charsPerRand && i+j < length; j++ {
			idx := int((r >> uint(j*numBytes)) & mask)
			b[i+j] = randStringChars[idx]
		}
	}

	return string(b)
}
