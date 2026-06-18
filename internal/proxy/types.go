package proxy

import (
	"net"
	"net/http"
	"sync"
)

const DefaultAddress = "0.0.0.0:8888"
const maxBodyPreviewBytes = 64 * 1024

type TrafficEntry struct {
	ID                    int64               `json:"id"`
	Time                  string              `json:"time"`
	Method                string              `json:"method"`
	URL                   string              `json:"url"`
	Host                  string              `json:"host"`
	Status                int                 `json:"status"`
	Bytes                 int64               `json:"bytes"`
	DurationMs            int64               `json:"durationMs"`
	Client                string              `json:"client"`
	Error                 string              `json:"error,omitempty"`
	IsConnect             bool                `json:"isConnect"`
	RequestBytes          int64               `json:"requestBytes"`
	RequestHeaders        map[string][]string `json:"requestHeaders,omitempty"`
	ResponseHeaders       map[string][]string `json:"responseHeaders,omitempty"`
	RequestBody           string              `json:"requestBody,omitempty"`
	ResponseBody          string              `json:"responseBody,omitempty"`
	RequestBodyTruncated  bool                `json:"requestBodyTruncated"`
	ResponseBodyTruncated bool                `json:"responseBodyTruncated"`
}

type Status struct {
	Running          bool           `json:"running"`
	Address          string         `json:"address"`
	LANURLs          []string       `json:"lanUrls"`
	CertURLs         []string       `json:"certUrls"`
	CertPath         string         `json:"certPath"`
	CertFingerprint  string         `json:"certFingerprint"`
	HTTPSInterceptOn bool           `json:"httpsInterceptOn"`
	Recent           []TrafficEntry `json:"recent"`
}

type Recorder func(TrafficEntry)

type Server struct {
	mu        sync.Mutex
	server    *http.Server
	listener  net.Listener
	client    *http.Client
	authority *Authority
	nextID    int64
	traffic   []TrafficEntry
	onRecord  Recorder
}

func NewServer(onRecord Recorder) *Server {
	return &Server{
		client:   &http.Client{Transport: http.DefaultTransport},
		onRecord: onRecord,
	}
}
