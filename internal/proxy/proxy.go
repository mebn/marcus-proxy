package proxy

import (
	"bufio"
	"bytes"
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
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
		client: &http.Client{
			Transport: http.DefaultTransport,
		},
		onRecord: onRecord,
	}
}

func (s *Server) Start(address string) (Status, error) {
	if address == "" {
		address = DefaultAddress
	}

	s.mu.Lock()
	if s.server != nil {
		status := s.statusLocked()
		s.mu.Unlock()
		return status, nil
	}
	s.mu.Unlock()

	authority, err := LoadOrCreateAuthority()
	if err != nil {
		return Status{}, err
	}

	listener, err := net.Listen("tcp", address)
	if err != nil {
		return Status{}, err
	}

	server := &http.Server{
		Handler:           s,
		ReadHeaderTimeout: 10 * time.Second,
	}

	s.mu.Lock()
	s.listener = listener
	s.server = server
	s.authority = authority
	status := s.statusLocked()
	s.mu.Unlock()

	go func() {
		if err := server.Serve(listener); err != nil && !errors.Is(err, http.ErrServerClosed) {
			s.record(TrafficEntry{
				Method: "SERVER",
				URL:    address,
				Host:   address,
				Error:  err.Error(),
				Time:   time.Now().Format(time.RFC3339),
			})
		}
	}()

	return status, nil
}

func (s *Server) Stop(ctx context.Context) error {
	s.mu.Lock()
	server := s.server
	s.server = nil
	s.listener = nil
	s.mu.Unlock()

	if server == nil {
		return nil
	}
	return server.Shutdown(ctx)
}

func (s *Server) Status() Status {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.statusLocked()
}

func (s *Server) SetTraffic(entries []TrafficEntry) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.traffic = append([]TrafficEntry(nil), entries...)
	var maxID int64
	for _, entry := range entries {
		if entry.ID > maxID {
			maxID = entry.ID
		}
	}
	s.nextID = maxID
}

func (s *Server) RegenerateAuthority() (Status, error) {
	authority, err := RegenerateAuthority()
	if err != nil {
		return Status{}, err
	}

	s.mu.Lock()
	s.authority = authority
	status := s.statusLocked()
	s.mu.Unlock()
	return status, nil
}

func (s *Server) ServeHTTP(rw http.ResponseWriter, req *http.Request) {
	start := time.Now()
	if req.Method == http.MethodConnect {
		s.handleConnect(rw, req, start)
		return
	}
	s.handleHTTP(rw, req, start)
}

func (s *Server) handleHTTP(rw http.ResponseWriter, req *http.Request, start time.Time) {
	if s.serveRootCertificate(rw, req) {
		return
	}

	target := req.URL
	if !target.IsAbs() {
		target = &url.URL{
			Scheme: "http",
			Host:   req.Host,
			Path:   req.URL.Path,
		}
		target.RawQuery = req.URL.RawQuery
	}

	outReq := req.Clone(req.Context())
	outReq.URL = target
	outReq.RequestURI = ""
	outReq.Header = req.Header.Clone()
	removeHopHeaders(outReq.Header)
	outReq.Header.Del("Proxy-Connection")

	requestBody, requestBodyTruncated, err := captureRequestBody(outReq)
	if err != nil {
		http.Error(rw, err.Error(), http.StatusBadRequest)
		s.recordHTTPExchange(outReq, target.String(), http.StatusBadRequest, 0, start, req.RemoteAddr, err, requestBody, requestBodyTruncated, "", false, nil)
		return
	}

	resp, err := s.client.Do(outReq)
	if err != nil {
		http.Error(rw, err.Error(), http.StatusBadGateway)
		s.recordHTTPExchange(outReq, target.String(), http.StatusBadGateway, 0, start, req.RemoteAddr, err, requestBody, requestBodyTruncated, "", false, nil)
		return
	}
	defer resp.Body.Close()

	removeHopHeaders(resp.Header)
	responseHeaders := cloneHeader(resp.Header)
	responseBodyBytes, readErr := io.ReadAll(resp.Body)
	responseBody, responseBodyTruncated := bodyPreview(responseBodyBytes)
	if readErr != nil {
		err = readErr
	}
	copyHeader(rw.Header(), resp.Header)
	rw.WriteHeader(resp.StatusCode)
	if _, writeErr := rw.Write(responseBodyBytes); writeErr != nil {
		err = writeErr
	}

	s.recordHTTPExchange(outReq, target.String(), resp.StatusCode, int64(len(responseBodyBytes)), start, req.RemoteAddr, err, requestBody, requestBodyTruncated, responseBody, responseBodyTruncated, responseHeaders)
}

func (s *Server) handleConnect(rw http.ResponseWriter, req *http.Request, start time.Time) {
	s.mu.Lock()
	authority := s.authority
	s.mu.Unlock()
	if authority == nil {
		http.Error(rw, "root certificate is unavailable", http.StatusInternalServerError)
		s.recordFromRequest(req, req.Host, http.StatusInternalServerError, 0, start, errors.New("root certificate is unavailable"), true)
		return
	}

	leaf, err := authority.CertificateForHost(req.Host)
	if err != nil {
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		s.recordFromRequest(req, req.Host, http.StatusBadGateway, 0, start, err, true)
		return
	}

	hijacker, ok := rw.(http.Hijacker)
	if !ok {
		http.Error(rw, "hijacking not supported", http.StatusInternalServerError)
		s.recordFromRequest(req, req.Host, http.StatusInternalServerError, 0, start, errors.New("hijacking not supported"), true)
		return
	}

	clientConn, _, err := hijacker.Hijack()
	if err != nil {
		s.recordFromRequest(req, req.Host, http.StatusInternalServerError, 0, start, err, true)
		return
	}

	if _, err := clientConn.Write([]byte("HTTP/1.1 200 Connection Established\r\n\r\n")); err != nil {
		clientConn.Close()
		s.recordFromRequest(req, req.Host, http.StatusBadGateway, 0, start, err, true)
		return
	}

	s.recordFromRequest(req, req.Host, http.StatusOK, 0, start, nil, true)
	tlsConn := tls.Server(clientConn, &tls.Config{
		Certificates: []tls.Certificate{leaf},
		NextProtos:   []string{"http/1.1"},
		MinVersion:   tls.VersionTLS12,
	})
	go s.handleTLSHTTP(tlsConn, req.Host, req.RemoteAddr)
}

func (s *Server) recordFromRequest(req *http.Request, rawURL string, status int, bytes int64, start time.Time, err error, isConnect bool) {
	entry := TrafficEntry{
		Time:         time.Now().Format(time.RFC3339),
		Method:       req.Method,
		URL:          rawURL,
		Host:         req.Host,
		Status:       status,
		Bytes:        bytes,
		DurationMs:   time.Since(start).Milliseconds(),
		Client:       strings.Split(req.RemoteAddr, ":")[0],
		IsConnect:    isConnect,
		RequestBytes: req.ContentLength,
	}
	if err != nil {
		entry.Error = err.Error()
	}
	s.record(entry)
}

func (s *Server) handleTLSHTTP(conn net.Conn, connectHost string, remoteAddr string) {
	defer conn.Close()

	reader := bufio.NewReader(conn)
	for {
		req, err := http.ReadRequest(reader)
		if err != nil {
			if !errors.Is(err, io.EOF) {
				s.record(TrafficEntry{
					Time:      time.Now().Format(time.RFC3339),
					Method:    "HTTPS",
					URL:       connectHost,
					Host:      connectHost,
					Status:    http.StatusBadGateway,
					Client:    strings.Split(remoteAddr, ":")[0],
					Error:     err.Error(),
					IsConnect: false,
				})
			}
			return
		}

		start := time.Now()
		targetURL := req.URL
		if !targetURL.IsAbs() {
			targetURL = &url.URL{
				Scheme:   "https",
				Host:     req.Host,
				Path:     req.URL.Path,
				RawQuery: req.URL.RawQuery,
			}
		}
		if targetURL.Host == "" {
			targetURL.Host = connectHost
		}
		if targetURL.Scheme == "" {
			targetURL.Scheme = "https"
		}

		req.URL = targetURL
		req.RequestURI = ""
		req.Header = req.Header.Clone()
		removeHopHeaders(req.Header)
		req.Header.Del("Proxy-Connection")

		requestBody, requestBodyTruncated, err := captureRequestBody(req)
		if err != nil {
			_ = writeErrorResponse(conn, http.StatusBadRequest, err.Error())
			s.recordHTTPExchange(req, targetURL.String(), http.StatusBadRequest, 0, start, remoteAddr, err, requestBody, requestBodyTruncated, "", false, nil)
			continue
		}

		resp, err := s.client.Do(req)
		if err != nil {
			_ = writeErrorResponse(conn, http.StatusBadGateway, err.Error())
			s.recordHTTPExchange(req, targetURL.String(), http.StatusBadGateway, 0, start, remoteAddr, err, requestBody, requestBodyTruncated, "", false, nil)
			continue
		}

		removeHopHeaders(resp.Header)
		responseHeaders := cloneHeader(resp.Header)
		responseBodyBytes, readErr := io.ReadAll(resp.Body)
		responseBody, responseBodyTruncated := bodyPreview(responseBodyBytes)
		resp.Body.Close()
		if readErr != nil {
			err = readErr
		}
		resp.Body = io.NopCloser(bytes.NewReader(responseBodyBytes))
		resp.ContentLength = int64(len(responseBodyBytes))
		writeErr := resp.Write(conn)
		if writeErr != nil {
			err = writeErr
		}
		s.recordHTTPExchange(req, targetURL.String(), resp.StatusCode, int64(len(responseBodyBytes)), start, remoteAddr, err, requestBody, requestBodyTruncated, responseBody, responseBodyTruncated, responseHeaders)
		if err != nil {
			return
		}
	}
}

func (s *Server) recordHTTPExchange(req *http.Request, rawURL string, status int, bytes int64, start time.Time, remoteAddr string, err error, requestBody string, requestBodyTruncated bool, responseBody string, responseBodyTruncated bool, responseHeaders map[string][]string) {
	entry := TrafficEntry{
		Time:                  time.Now().Format(time.RFC3339),
		Method:                req.Method,
		URL:                   rawURL,
		Host:                  req.Host,
		Status:                status,
		Bytes:                 bytes,
		DurationMs:            time.Since(start).Milliseconds(),
		Client:                strings.Split(remoteAddr, ":")[0],
		RequestBytes:          req.ContentLength,
		RequestHeaders:        cloneHeader(req.Header),
		ResponseHeaders:       responseHeaders,
		RequestBody:           requestBody,
		ResponseBody:          responseBody,
		RequestBodyTruncated:  requestBodyTruncated,
		ResponseBodyTruncated: responseBodyTruncated,
	}
	if err != nil {
		entry.Error = err.Error()
	}
	s.record(entry)
}

func (s *Server) serveRootCertificate(rw http.ResponseWriter, req *http.Request) bool {
	if req.URL.Path != "/rootCA.cer" && req.URL.Path != "/rootCA.pem" {
		return false
	}
	s.mu.Lock()
	authority := s.authority
	s.mu.Unlock()
	if authority == nil {
		http.Error(rw, "root certificate is unavailable", http.StatusInternalServerError)
		return true
	}
	cert := authority.RootDER()
	rw.Header().Set("Content-Type", "application/x-x509-ca-cert")
	rw.Header().Set("Content-Disposition", `attachment; filename="marcus-proxy-root-ca.cer"`)
	rw.Header().Set("Content-Length", fmt.Sprintf("%d", len(cert)))
	_, _ = rw.Write(cert)
	return true
}

func (s *Server) record(entry TrafficEntry) {
	s.mu.Lock()
	s.nextID++
	entry.ID = s.nextID
	if entry.Time == "" {
		entry.Time = time.Now().Format(time.RFC3339)
	}
	s.traffic = append([]TrafficEntry{entry}, s.traffic...)
	recorder := s.onRecord
	s.mu.Unlock()

	if recorder != nil {
		recorder(entry)
	}
}

func (s *Server) statusLocked() Status {
	status := Status{
		Running:          s.server != nil,
		LANURLs:          []string{},
		CertURLs:         []string{},
		Recent:           []TrafficEntry{},
		HTTPSInterceptOn: s.authority != nil,
	}
	status.Recent = append(status.Recent, s.traffic...)
	if s.authority != nil {
		status.CertPath = s.authority.CertDERPath()
		status.CertFingerprint = s.authority.Fingerprint()
	}
	if s.listener != nil {
		status.Address = s.listener.Addr().String()
		status.LANURLs = lanURLs(s.listener.Addr())
		for _, lanURL := range status.LANURLs {
			status.CertURLs = append(status.CertURLs, lanURL+"/rootCA.cer")
		}
	}
	return status
}

func tunnel(a net.Conn, b net.Conn) {
	var wg sync.WaitGroup
	var once sync.Once
	closeBoth := func() {
		a.Close()
		b.Close()
	}
	copySide := func(dst net.Conn, src net.Conn) {
		defer wg.Done()
		_, _ = io.Copy(dst, src)
		once.Do(closeBoth)
	}

	wg.Add(2)
	go copySide(a, b)
	go copySide(b, a)
	wg.Wait()
}

func copyHeader(dst http.Header, src http.Header) {
	for key, values := range src {
		for _, value := range values {
			dst.Add(key, value)
		}
	}
}

func writeErrorResponse(w io.Writer, status int, message string) error {
	resp := &http.Response{
		StatusCode:    status,
		Status:        fmt.Sprintf("%d %s", status, http.StatusText(status)),
		Proto:         "HTTP/1.1",
		ProtoMajor:    1,
		ProtoMinor:    1,
		Header:        make(http.Header),
		Body:          io.NopCloser(strings.NewReader(message)),
		ContentLength: int64(len(message)),
	}
	resp.Header.Set("Content-Type", "text/plain; charset=utf-8")
	return resp.Write(w)
}

func captureRequestBody(req *http.Request) (string, bool, error) {
	if req.Body == nil || req.Body == http.NoBody {
		return "", false, nil
	}
	body, err := io.ReadAll(req.Body)
	if err != nil {
		return "", false, err
	}
	req.Body.Close()
	req.Body = io.NopCloser(bytes.NewReader(body))
	req.ContentLength = int64(len(body))
	req.GetBody = func() (io.ReadCloser, error) {
		return io.NopCloser(bytes.NewReader(body)), nil
	}
	preview, truncated := bodyPreview(body)
	return preview, truncated, nil
}

func bodyPreview(body []byte) (string, bool) {
	truncated := len(body) > maxBodyPreviewBytes
	if truncated {
		body = body[:maxBodyPreviewBytes]
	}
	if len(body) == 0 {
		return "", false
	}
	text := string(body)
	text = strings.ToValidUTF8(text, "\uFFFD")
	if truncated {
		text += "\n\n[truncated]"
	}
	return text, truncated
}

func cloneHeader(header http.Header) map[string][]string {
	if len(header) == 0 {
		return nil
	}
	clone := make(map[string][]string, len(header))
	for key, values := range header {
		clone[key] = append([]string(nil), values...)
	}
	return clone
}

func removeHopHeaders(header http.Header) {
	for _, name := range []string{
		"Connection",
		"Keep-Alive",
		"Proxy-Authenticate",
		"Proxy-Authorization",
		"Te",
		"Trailer",
		"Transfer-Encoding",
		"Upgrade",
	} {
		header.Del(name)
	}
}

func lanURLs(addr net.Addr) []string {
	_, port, err := net.SplitHostPort(addr.String())
	if err != nil {
		return nil
	}

	var urls []string
	ifaces, err := net.Interfaces()
	if err != nil {
		return []string{fmt.Sprintf("http://127.0.0.1:%s", port)}
	}
	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, ifaceAddr := range addrs {
			ipNet, ok := ifaceAddr.(*net.IPNet)
			if !ok {
				continue
			}
			ip := ipNet.IP.To4()
			if ip == nil || ip.IsLoopback() {
				continue
			}
			urls = append(urls, fmt.Sprintf("http://%s:%s", ip.String(), port))
		}
	}
	if len(urls) == 0 {
		urls = append(urls, fmt.Sprintf("http://127.0.0.1:%s", port))
	}
	return urls
}
