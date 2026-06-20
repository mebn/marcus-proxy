package proxy

import (
	"bufio"
	"bytes"
	"crypto/tls"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"
)

func (s *Server) handleHTTP(rw http.ResponseWriter, req *http.Request, start time.Time) {
	if s.serveRootCertificate(rw, req) {
		return
	}

	target := httpTarget(req)
	outReq := prepareOutgoingRequest(req, target)
	requestBody, requestBodyTruncated, err := captureRequestBody(outReq)
	if err != nil {
		http.Error(rw, err.Error(), http.StatusBadRequest)
		s.recordHTTPExchange(outReq, target.String(), http.StatusBadRequest, 0, start, req.RemoteAddr, err, requestBody, requestBodyTruncated, "", false, nil)
		return
	}

	entryID := int64(0)
	if s.shouldIntercept("request") || s.shouldIntercept("response") {
		entryID = s.nextTrafficID()
	}
	if s.shouldIntercept("request") {
		edited, err := s.pauseIntercept(req.Context(), TrafficEntry{
			ID:                   entryID,
			Time:                 time.Now().Format(time.RFC3339),
			Method:               outReq.Method,
			URL:                  target.String(),
			Host:                 outReq.Host,
			Client:               strings.Split(req.RemoteAddr, ":")[0],
			RequestHeaders:       cloneHeader(outReq.Header),
			RequestBody:          requestBody,
			RequestBodyTruncated: requestBodyTruncated,
			InterceptPhase:       "request",
		})
		if err != nil {
			http.Error(rw, err.Error(), http.StatusGatewayTimeout)
			s.recordHTTPExchangeWithID(entryID, outReq, target.String(), http.StatusGatewayTimeout, 0, start, req.RemoteAddr, err, requestBody, requestBodyTruncated, "", false, nil)
			return
		}
		requestBody, requestBodyTruncated, err = applyRequestEdit(outReq, edited)
		if err != nil {
			http.Error(rw, err.Error(), http.StatusBadRequest)
			s.recordHTTPExchangeWithID(entryID, outReq, target.String(), http.StatusBadRequest, 0, start, req.RemoteAddr, err, requestBody, requestBodyTruncated, "", false, nil)
			return
		}
		target = outReq.URL
	}

	resp, err := s.client.Do(outReq)
	if err != nil {
		http.Error(rw, err.Error(), http.StatusBadGateway)
		s.recordHTTPExchangeWithID(entryID, outReq, target.String(), http.StatusBadGateway, 0, start, req.RemoteAddr, err, requestBody, requestBodyTruncated, "", false, nil)
		return
	}
	defer resp.Body.Close()

	body, responseBody, responseBodyTruncated, responseHeaders, err := readResponse(resp)
	if err == nil && s.shouldIntercept("response") {
		edited, pauseErr := s.pauseIntercept(req.Context(), TrafficEntry{
			ID:                    entryID,
			Time:                  time.Now().Format(time.RFC3339),
			Method:                outReq.Method,
			URL:                   target.String(),
			Host:                  outReq.Host,
			Status:                resp.StatusCode,
			Bytes:                 int64(len(body)),
			DurationMs:            time.Since(start).Milliseconds(),
			Client:                strings.Split(req.RemoteAddr, ":")[0],
			RequestBytes:          outReq.ContentLength,
			RequestHeaders:        cloneHeader(outReq.Header),
			ResponseHeaders:       responseHeaders,
			RequestBody:           requestBody,
			ResponseBody:          responseBody,
			RequestBodyTruncated:  requestBodyTruncated,
			ResponseBodyTruncated: responseBodyTruncated,
			InterceptPhase:        "response",
		})
		if pauseErr != nil {
			err = pauseErr
		} else {
			body, responseBody, responseBodyTruncated, responseHeaders = applyResponseEdit(resp, edited)
		}
	}
	copyHeader(rw.Header(), resp.Header)
	rw.WriteHeader(resp.StatusCode)
	if _, writeErr := rw.Write(body); writeErr != nil {
		err = writeErr
	}
	s.recordHTTPExchangeWithID(entryID, outReq, target.String(), resp.StatusCode, int64(len(body)), start, req.RemoteAddr, err, requestBody, requestBodyTruncated, responseBody, responseBodyTruncated, responseHeaders)
}

func (s *Server) handleConnect(rw http.ResponseWriter, req *http.Request, start time.Time) {
	authority := s.currentAuthority()
	if authority == nil {
		err := errors.New("root certificate is unavailable")
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		s.recordFromRequest(req, req.Host, http.StatusInternalServerError, 0, start, err, true)
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
		err := errors.New("hijacking not supported")
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		s.recordFromRequest(req, req.Host, http.StatusInternalServerError, 0, start, err, true)
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

func (s *Server) handleTLSHTTP(conn net.Conn, connectHost string, remoteAddr string) {
	defer conn.Close()

	reader := bufio.NewReader(conn)
	for {
		req, err := http.ReadRequest(reader)
		if err != nil {
			s.recordTLSReadError(err, connectHost, remoteAddr)
			return
		}
		if !s.forwardTLSRequest(conn, req, connectHost, remoteAddr) {
			return
		}
	}
}

func (s *Server) forwardTLSRequest(conn net.Conn, req *http.Request, connectHost string, remoteAddr string) bool {
	start := time.Now()
	target := httpsTarget(req, connectHost)
	req.URL = target
	prepareRequestInPlace(req)

	requestBody, requestBodyTruncated, err := captureRequestBody(req)
	if err != nil {
		_ = writeErrorResponse(conn, http.StatusBadRequest, err.Error())
		s.recordHTTPExchange(req, target.String(), http.StatusBadRequest, 0, start, remoteAddr, err, requestBody, requestBodyTruncated, "", false, nil)
		return true
	}

	entryID := int64(0)
	if s.shouldIntercept("request") || s.shouldIntercept("response") {
		entryID = s.nextTrafficID()
	}
	if s.shouldIntercept("request") {
		edited, err := s.pauseIntercept(req.Context(), TrafficEntry{
			ID:                   entryID,
			Time:                 time.Now().Format(time.RFC3339),
			Method:               req.Method,
			URL:                  target.String(),
			Host:                 req.Host,
			Client:               strings.Split(remoteAddr, ":")[0],
			RequestHeaders:       cloneHeader(req.Header),
			RequestBody:          requestBody,
			RequestBodyTruncated: requestBodyTruncated,
			InterceptPhase:       "request",
		})
		if err != nil {
			_ = writeErrorResponse(conn, http.StatusGatewayTimeout, err.Error())
			s.recordHTTPExchangeWithID(entryID, req, target.String(), http.StatusGatewayTimeout, 0, start, remoteAddr, err, requestBody, requestBodyTruncated, "", false, nil)
			return true
		}
		requestBody, requestBodyTruncated, err = applyRequestEdit(req, edited)
		if err != nil {
			_ = writeErrorResponse(conn, http.StatusBadRequest, err.Error())
			s.recordHTTPExchangeWithID(entryID, req, target.String(), http.StatusBadRequest, 0, start, remoteAddr, err, requestBody, requestBodyTruncated, "", false, nil)
			return true
		}
		target = req.URL
	}

	resp, err := s.client.Do(req)
	if err != nil {
		_ = writeErrorResponse(conn, http.StatusBadGateway, err.Error())
		s.recordHTTPExchangeWithID(entryID, req, target.String(), http.StatusBadGateway, 0, start, remoteAddr, err, requestBody, requestBodyTruncated, "", false, nil)
		return true
	}

	body, responseBody, responseBodyTruncated, responseHeaders, err := readResponse(resp)
	if err == nil && s.shouldIntercept("response") {
		edited, pauseErr := s.pauseIntercept(req.Context(), TrafficEntry{
			ID:                    entryID,
			Time:                  time.Now().Format(time.RFC3339),
			Method:                req.Method,
			URL:                   target.String(),
			Host:                  req.Host,
			Status:                resp.StatusCode,
			Bytes:                 int64(len(body)),
			DurationMs:            time.Since(start).Milliseconds(),
			Client:                strings.Split(remoteAddr, ":")[0],
			RequestBytes:          req.ContentLength,
			RequestHeaders:        cloneHeader(req.Header),
			ResponseHeaders:       responseHeaders,
			RequestBody:           requestBody,
			ResponseBody:          responseBody,
			RequestBodyTruncated:  requestBodyTruncated,
			ResponseBodyTruncated: responseBodyTruncated,
			InterceptPhase:        "response",
		})
		if pauseErr != nil {
			err = pauseErr
		} else {
			body, responseBody, responseBodyTruncated, responseHeaders = applyResponseEdit(resp, edited)
		}
	}
	resp.Body.Close()
	resp.Body = io.NopCloser(bytes.NewReader(body))
	resp.ContentLength = int64(len(body))
	if writeErr := resp.Write(conn); writeErr != nil {
		err = writeErr
	}
	s.recordHTTPExchangeWithID(entryID, req, target.String(), resp.StatusCode, int64(len(body)), start, remoteAddr, err, requestBody, requestBodyTruncated, responseBody, responseBodyTruncated, responseHeaders)
	return err == nil
}

func (s *Server) recordTLSReadError(err error, connectHost string, remoteAddr string) {
	if errors.Is(err, io.EOF) {
		return
	}
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

func (s *Server) recordHTTPExchange(req *http.Request, rawURL string, status int, bytes int64, start time.Time, remoteAddr string, err error, requestBody string, requestBodyTruncated bool, responseBody string, responseBodyTruncated bool, responseHeaders map[string][]string) TrafficEntry {
	return s.recordHTTPExchangeWithID(0, req, rawURL, status, bytes, start, remoteAddr, err, requestBody, requestBodyTruncated, responseBody, responseBodyTruncated, responseHeaders)
}

func (s *Server) recordHTTPExchangeWithID(id int64, req *http.Request, rawURL string, status int, bytes int64, start time.Time, remoteAddr string, err error, requestBody string, requestBodyTruncated bool, responseBody string, responseBodyTruncated bool, responseHeaders map[string][]string) TrafficEntry {
	entry := TrafficEntry{
		ID:                    id,
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
	return s.record(entry)
}

func (s *Server) serveRootCertificate(rw http.ResponseWriter, req *http.Request) bool {
	if req.URL.Path != "/rootCA.cer" && req.URL.Path != "/rootCA.pem" {
		return false
	}
	authority := s.currentAuthority()
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

func (s *Server) currentAuthority() *Authority {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.authority
}

func httpTarget(req *http.Request) *url.URL {
	if req.URL.IsAbs() {
		return req.URL
	}
	target := &url.URL{Scheme: "http", Host: req.Host, Path: req.URL.Path}
	target.RawQuery = req.URL.RawQuery
	return target
}

func httpsTarget(req *http.Request, connectHost string) *url.URL {
	target := req.URL
	if !target.IsAbs() {
		target = &url.URL{Scheme: "https", Host: req.Host, Path: req.URL.Path, RawQuery: req.URL.RawQuery}
	}
	if target.Host == "" {
		target.Host = connectHost
	}
	if target.Scheme == "" {
		target.Scheme = "https"
	}
	return target
}

func prepareOutgoingRequest(req *http.Request, target *url.URL) *http.Request {
	outReq := req.Clone(req.Context())
	outReq.URL = target
	prepareRequestInPlace(outReq)
	return outReq
}

func prepareRequestInPlace(req *http.Request) {
	req.RequestURI = ""
	req.Header = req.Header.Clone()
	removeHopHeaders(req.Header)
	req.Header.Del("Proxy-Connection")
}
