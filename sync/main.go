package main

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha1"
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"
	"sync"
	"time"

	"golang.org/x/sync/errgroup"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbattribute"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/aws/aws-sdk-go/service/s3/s3manager"
	_ "github.com/go-sql-driver/mysql"
	"github.com/pkg/errors"
)

const LogOnly = false
const Concurrency = 5

var db *sql.DB
var awsSession = session.Must(session.NewSession(&aws.Config{Region: aws.String("us-east-1")}))
var ddb = dynamodb.New(awsSession)
var s3c = s3.New(awsSession)
var downloader = s3manager.NewDownloader(awsSession)
var uploader = s3manager.NewUploader(awsSession)

func main() {
	start := time.Now()

	var err error
	db, err = sql.Open("mysql", os.Getenv("MYSQL")+"diff.pics?parseTime=true")
	if err != nil {
		log.Print("sql.Open:", err)
		return
	}

	comparisons, err := getComparisons()
	if err != nil {
		log.Print("getComparisons:", err)
		return
	}
	log.Printf("Found %d comparisons", len(comparisons))

	images, err := getImages()
	if err != nil {
		log.Print("getImages:", err)
		return
	}
	log.Printf("Found %d images", len(images))

	savedComparisons, err := getSavedComparisons()
	if err != nil {
		log.Print("getSavedComparisons:", err)
		return
	}
	log.Printf("Found %d savedComparisons", len(savedComparisons))

	savedComparisonImages, err := getSavedComparisonImages()
	if err != nil {
		log.Print("getSavedComparisonImages:", err)
		return
	}
	log.Printf("Found %d savedComparisonImages", len(savedComparisonImages))

	savedImages, err := getSavedImages()
	if err != nil {
		log.Print("getSavedImages:", err)
		return
	}
	log.Printf("Found %d savedImages", len(savedImages))
	for hash, img := range savedImages {
		images[hash].uploaded = true
		images[hash].data = img
	}

	uploaded := 0
	created := 0
	updated := 0
	fixed := 0
	wg := &sync.WaitGroup{}
	sem := make(chan struct{}, Concurrency)
	for i := 0; i < Concurrency; i++ {
		sem <- struct{}{}
	}
	for _, c := range comparisons {
		create := true
		update := false
		validate := false
		if data, exists := savedComparisons[c.Key]; exists {
			create = false
			update = data.Views != c.Views
			validate = true
		}

		// Upload missing images
		for _, r := range c.Comparisons {
			for _, i := range r {
				if images[i].data.ID == "" {
					create = false
				}
				if !images[i].uploaded {
					uploaded++
					if LogOnly {
						log.Println(i, c.Key, c.Title)
					} else {
						images[i].uploaded = true
						_, err = s3c.CopyObject(&s3.CopyObjectInput{
							CopySource: aws.String("/diff.pics/" + images[i].SHA1 + images[i].Ext),
							Bucket:     aws.String("upload.diff.pics"),
							Key:        aws.String(images[i].SHA1),
						})
						if err != nil {
							log.Print("s3c.CopyObject:", err)
							return
						}
					}
				}
			}
		}

		// If no missing images, create the comparison
		switch {
		case create:
			created++
			wg.Add(1)
			go createComparison(sem, wg, c, images)
		case update:
			updated++
			_, err = db.Exec("UPDATE `comparisons` SET `views` = ? WHERE `key` = ?", c.Views, c.Key)
			if err != nil {
				log.Printf("Failed to update views for %s: %v", c.Key, err)
			}
		case validate:
			cid := savedComparisons[c.Key].ID
			for r, row := range c.Comparisons {
				for col, i := range row {
					if _, exists := savedComparisonImages[sqlComparisonImage{cid, r, col}]; !exists {
						fixed++
						img := images[i]
						_, err = db.Exec("INSERT INTO `comparison_images`(`comparison_id`, `row`, `column`, `image_id`, `name`) VALUES (?,?,?,?,?)", cid, r, col, img.data.ID, img.Filename)
						if err != nil {
							log.Printf("createComparisonImage %s:%d:%d: Failed to insert comparison images: %v", c.Key, r, col, err)
						}
					}
				}
			}
		}
	}

	log.Printf("Copied %d images, updated %d comparisons and fixed %d comparison images in %s", uploaded, updated, fixed, time.Since(start))
	wg.Wait()
	log.Printf("Created %d comparisons in %s", created, time.Since(start))
}

type ddbComparison struct {
	Key         string
	Title       string
	Views       int
	Comparisons [][]string
}

func getComparisons() ([]ddbComparison, error) {
	var records []ddbComparison
	handleScan := func(page *dynamodb.ScanOutput, last bool) bool {
		recs := []ddbComparison{}
		err := dynamodbattribute.UnmarshalListOfMaps(page.Items, &recs)
		if err != nil {
			panic(fmt.Sprintf("failed to unmarshal Dynamodb Scan Items, %v", err))
		}
		records = append(records, recs...)
		return true // keep paging
	}
	err := ddb.ScanPages(&dynamodb.ScanInput{TableName: aws.String("diff.pics-comparisons")}, handleScan)
	return records, err
}

type ddbImage struct {
	SHA1     string
	Filename string
	Ext      string
	uploaded bool
	data     sqlImage
}

func getImages() (map[string]*ddbImage, error) {
	records := map[string]*ddbImage{}
	handleScan := func(page *dynamodb.ScanOutput, last bool) bool {
		recs := []ddbImage{}
		err := dynamodbattribute.UnmarshalListOfMaps(page.Items, &recs)
		if err != nil {
			panic(fmt.Sprintf("failed to unmarshal Dynamodb Scan Items, %v", err))
		}
		for _, rec := range recs {
			rec := rec
			records[rec.SHA1] = &rec
		}
		return true // keep paging
	}
	err := ddb.ScanPages(&dynamodb.ScanInput{TableName: aws.String("diff.pics-images")}, handleScan)
	return records, err
}

type sqlComparison struct {
	ID    string
	Views int
}

func getSavedComparisons() (map[string]sqlComparison, error) {
	r := map[string]sqlComparison{}
	rows, err := db.Query("SELECT `id`, `key`, `views` FROM `comparisons`")
	if err != nil {
		return nil, fmt.Errorf("Invalid SQL: %v", err)
	}
	defer rows.Close()
	for rows.Next() {
		var (
			id    string
			key   string
			views int
		)
		err = rows.Scan(&id, &key, &views)
		if err != nil {
			return nil, fmt.Errorf("Invalid SQL: %v", err)
		}
		r[key] = sqlComparison{id, views}
	}
	err = rows.Err()
	if err != nil {
		return nil, fmt.Errorf("Invalid SQL: %v", err)
	}
	return r, nil
}

type sqlImage struct {
	ID    string
	Thumb string
}

func getSavedImages() (map[string]sqlImage, error) {
	r := map[string]sqlImage{}
	rows, err := db.Query("SELECT `id`, `path`, `thumb` FROM `images`")
	if err != nil {
		return nil, fmt.Errorf("Invalid SQL: %v", err)
	}
	defer rows.Close()
	for rows.Next() {
		var (
			id    string
			path  string
			thumb string
		)
		err = rows.Scan(&id, &path, &thumb)
		if err != nil {
			return nil, fmt.Errorf("Invalid SQL: %v", err)
		}
		r[strings.Replace(path, "/", "", -1)] = sqlImage{id, thumb}
	}
	err = rows.Err()
	if err != nil {
		return nil, fmt.Errorf("Invalid SQL: %v", err)
	}
	return r, nil
}

type sqlComparisonImage struct {
	ComparisonID string
	Row          int
	Column       int
}

func getSavedComparisonImages() (map[sqlComparisonImage]string, error) {
	r := map[sqlComparisonImage]string{}
	rows, err := db.Query("SELECT `comparison_id`, `row`, `column`, `image_id` FROM `comparison_images`")
	if err != nil {
		return nil, fmt.Errorf("Invalid SQL: %v", err)
	}
	defer rows.Close()
	for rows.Next() {
		var (
			cid string
			row int
			col int
			iid string
		)
		err = rows.Scan(&cid, &row, &col, &iid)
		if err != nil {
			return nil, fmt.Errorf("Invalid SQL: %v", err)
		}
		r[sqlComparisonImage{cid, row, col}] = iid
	}
	err = rows.Err()
	if err != nil {
		return nil, fmt.Errorf("Invalid SQL: %v", err)
	}
	return r, nil
}

func createComparison(sem chan struct{}, wg *sync.WaitGroup, c ddbComparison, images map[string]*ddbImage) {
	defer wg.Done()
	defer func() { sem <- struct{}{} }()
	<-sem

	m := &sync.Mutex{}
	imgFiles := map[string][]byte{}
	eg, ctx := errgroup.WithContext(context.Background())
	for rowNum, r := range c.Comparisons {
		for _, i := range r {
			rowNum := rowNum
			img := images[i]
			eg.Go(func() error {
				buf := aws.NewWriteAtBuffer([]byte{})
				_, err := downloader.DownloadWithContext(ctx, buf, &s3.GetObjectInput{
					Bucket: aws.String("diff.pics"),
					Key:    aws.String(fmt.Sprintf("images/%s/%s/%s", img.SHA1[0:2], img.SHA1[2:4], img.SHA1[4:])),
				})

				zipName := fmt.Sprintf("%d/%s%s", rowNum, img.Filename, img.Ext)
				m.Lock()
				imgFiles[zipName] = buf.Bytes()
				m.Unlock()
				return errors.Wrap(err, img.SHA1)
			})
		}
	}
	if err := eg.Wait(); err != nil {
		log.Printf("createComparison %s: Failed to download images: %v", c.Key, err)
		return
	}

	// Make the zip file
	buf := &bytes.Buffer{}
	zw := zip.NewWriter(buf)
	for name, data := range imgFiles {
		f, err := zw.Create(name)
		if err != nil {
			log.Printf("createComparison %s: Failed to create zip file: %v", c.Key, err)
			return
		}
		_, err = f.Write(data)
		if err != nil {
			log.Printf("createComparison %s: Failed to create zip file: %v", c.Key, err)
			return
		}
	}
	if err := zw.Close(); err != nil {
		log.Printf("createComparison %s: Failed to create zip file: %v", c.Key, err)
		return
	}

	// Upload the zip file
	zipName := fmt.Sprintf("%X", sha1.Sum(buf.Bytes()))
	zipName = fmt.Sprintf("%s/%s/%s", zipName[0:2], zipName[2:4], zipName[4:])
	_, err := uploader.Upload(&s3manager.UploadInput{
		Bucket: aws.String("diff.pics"),
		Key:    aws.String("zips/" + zipName),
		Body:   buf,
	})
	if err != nil {
		log.Printf("createComparison %s: Failed to upload zip file: %v", c.Key, err)
		return
	}

	// Add comparison to the database
	title := "Untitled"
	if c.Title != "" {
		title = c.Title
	}
	result, err := db.Exec("INSERT INTO `comparisons`(`key`, `title`, `zip`, `views`) VALUES(?,?,?,?)", c.Key, title, zipName, c.Views)
	if err != nil {
		log.Printf("createComparison %s: Failed to insert comparison: %v", c.Key, err)
		return
	}
	comparisonID, err := result.LastInsertId()
	if err != nil {
		log.Printf("createComparison %s: Failed to fetch comparison id: %v", c.Key, err)
		return
	}

	// Add images to the database
	numImages := 0
	args := []interface{}{}
	for r, row := range c.Comparisons {
		for c, i := range row {
			img := images[i]
			numImages++
			args = append(args, comparisonID, r, c, img.data.ID, img.Filename)
		}
	}
	rowTemplate := "(?,?,?,?,?)"
	_, err = db.Exec(fmt.Sprintf("INSERT INTO `comparison_images`(`comparison_id`, `row`, `column`, `image_id`, `name`) VALUES %s%s", rowTemplate, strings.Repeat(","+rowTemplate, numImages-1)), args...)
	if err != nil {
		log.Printf("createComparison %s: Failed to insert comparison images: %v", c.Key, err)
		return
	}
}
