package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"
	"time"
)

func check_images(r *http.Request) (interface{}, error) {
	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		return nil, fmt.Errorf("Could not read request body")
	}

	hashes := []string{}
	err = json.Unmarshal(body, &hashes)
	if err != nil {
		return nil, fmt.Errorf("Could not decode request body")
	}
	if len(hashes) == 0 {
		return nil, fmt.Errorf("No hashes to check")
	}
	args := make([]interface{}, len(hashes))
	for i, h := range hashes {
		if !hashRe.MatchString(h) {
			return nil, fmt.Errorf("Invalid hash: %v", h)
		}
		hashes[i] = fmt.Sprintf("%s/%s/%s", h[0:2], h[2:4], h[4:])
		args[i] = hashes[i]
	}

	exists := map[string]struct{}{}
	rows, err := db.Query(fmt.Sprintf("SELECT path FROM images WHERE path IN (?%s)", strings.Repeat(",?", len(hashes)-1)), args...)
	if err != nil {
		return nil, fmt.Errorf("Invalid SQL: %v", err)
	}
	defer rows.Close()
	for rows.Next() {
		var path string
		err = rows.Scan(&path)
		if err != nil {
			return nil, fmt.Errorf("Invalid SQL: %v", err)
		}
		exists[path] = struct{}{}
	}
	err = rows.Err()
	if err != nil {
		return nil, fmt.Errorf("Invalid SQL: %v", err)
	}

	p := newPolicy()
	resp := map[string]imageUpload{}
	for _, h := range hashes {
		if _, ok := exists[h]; ok {
			continue
		}

		p.key = strings.Replace(h, "/", "", -1)
		b, err := p.Encode()
		if err != nil {
			return nil, fmt.Errorf("Unable to generate policy: %v", err)
		}

		resp[p.key] = imageUpload{
			URL:        "https://s3.amazonaws.com/upload.diff.pics/",
			Key:        h,
			Policy:     b,
			Signature:  sign(b, p.date[:8]),
			Credential: p.cred,
			Date:       p.date,
		}
	}

	return resp, nil
}

type imageUpload struct {
	URL        string
	Key        string
	Policy     string
	Signature  string
	Credential string
	Date       string
}

type policy struct {
	Expiration string        `json:"expiration"`
	Conditions []interface{} `json:"conditions"`

	key  string
	date string
	cred string
}

func newPolicy() *policy {
	date := time.Now().UTC().Format("20060102T150405Z")
	cred := fmt.Sprintf("%s/%s/%s/s3/aws4_request", awsAccessKey, date[:8], awsRegion)
	p := &policy{
		Expiration: time.Now().Add(1 * time.Hour).UTC().Format("2006-01-02T15:04:05.000Z"),
		Conditions: []interface{}{
			map[string]string{"bucket": "upload.diff.pics"},
			[]string{"starts-with", "$content-type", "image/"},
			map[string]string{"x-amz-credential": cred},
			map[string]string{"x-amz-date": date},
			map[string]string{"x-amz-algorithm": "AWS4-HMAC-SHA256"},
		},
		date: date,
		cred: cred,
	}
	p.Conditions = append(p.Conditions, map[string]*string{"key": &p.key})
	return p
}

func (p *policy) Encode() (string, error) {
	data, err := json.Marshal(p)
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(data), nil
}

func sign(s string, date string) string {
	h := func(key []byte, data string) []byte {
		hm := hmac.New(sha256.New, key)
		hm.Write([]byte(data))
		return hm.Sum(nil)
	}
	sig := h(h(h(h(h([]byte("AWS4"+awsSecretAccessKey), date), awsRegion), "s3"), "aws4_request"), s)
	return hex.EncodeToString(sig)
}
