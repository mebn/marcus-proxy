package proxy

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

func (s *Server) SetInterceptHandler(handler Recorder) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.onIntercept = handler
}

func (s *Server) SetInterceptSettings(settings InterceptSettings) InterceptSettings {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.interceptSettings = settings
	return s.interceptSettings
}

func (s *Server) InterceptSettings() InterceptSettings {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.interceptSettings
}

func (s *Server) ContinueIntercept(entry TrafficEntry) error {
	s.mu.Lock()
	ch := s.pendingIntercepts[entry.ID]
	s.mu.Unlock()
	if ch == nil {
		return fmt.Errorf("paused request %d not found", entry.ID)
	}

	select {
	case ch <- entry:
		return nil
	default:
		return fmt.Errorf("paused request %d already resumed", entry.ID)
	}
}

func (s *Server) Resend(entry TrafficEntry) (TrafficEntry, error) {
	start := time.Now()
	req, err := requestFromEntry(entry)
	if err != nil {
		return TrafficEntry{}, err
	}

	requestBody, requestBodyTruncated, err := captureRequestBody(req)
	if err != nil {
		s.recordHTTPExchange(req, entry.URL, http.StatusBadRequest, 0, start, "manual", err, requestBody, requestBodyTruncated, "", false, nil)
		return TrafficEntry{}, err
	}

	resp, err := s.client.Do(req)
	if err != nil {
		s.recordHTTPExchange(req, entry.URL, http.StatusBadGateway, 0, start, "manual", err, requestBody, requestBodyTruncated, "", false, nil)
		return TrafficEntry{}, err
	}
	defer resp.Body.Close()

	body, responseBody, responseBodyTruncated, responseHeaders, err := readResponse(resp)
	record := s.recordHTTPExchange(req, entry.URL, resp.StatusCode, int64(len(body)), start, "manual", err, requestBody, requestBodyTruncated, responseBody, responseBodyTruncated, responseHeaders)
	return record, err
}

func (s *Server) nextTrafficID() int64 {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.nextID++
	return s.nextID
}

func (s *Server) shouldIntercept(phase string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if phase == "request" {
		return s.interceptSettings.EditRequest
	}
	return s.interceptSettings.EditResponse
}

func (s *Server) pauseIntercept(ctx context.Context, entry TrafficEntry) (TrafficEntry, error) {
	entry.Paused = true
	ch := make(chan TrafficEntry, 1)

	s.mu.Lock()
	s.pendingIntercepts[entry.ID] = ch
	handler := s.onIntercept
	s.mu.Unlock()

	if handler != nil {
		handler(entry)
	}

	select {
	case edited := <-ch:
		s.removePendingIntercept(entry.ID)
		edited.ID = entry.ID
		edited.Paused = false
		edited.InterceptPhase = entry.InterceptPhase
		return edited, nil
	case <-ctx.Done():
		s.removePendingIntercept(entry.ID)
		return entry, ctx.Err()
	}
}

func (s *Server) removePendingIntercept(id int64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.pendingIntercepts, id)
}

func applyRequestEdit(req *http.Request, edited TrafficEntry) (string, bool, error) {
	if edited.Method != "" {
		req.Method = edited.Method
	}
	if edited.URL != "" {
		target, err := url.Parse(edited.URL)
		if err != nil {
			return "", false, err
		}
		req.URL = target
		req.Host = target.Host
	}
	if edited.Host != "" {
		req.Host = edited.Host
	}
	req.Header = http.Header(edited.RequestHeaders).Clone()
	removeHopHeaders(req.Header)
	body := []byte(edited.RequestBody)
	req.Body = io.NopCloser(bytes.NewReader(body))
	req.ContentLength = int64(len(body))
	req.GetBody = func() (io.ReadCloser, error) {
		return io.NopCloser(bytes.NewReader(body)), nil
	}
	return edited.RequestBody, false, nil
}

func applyResponseEdit(resp *http.Response, edited TrafficEntry) ([]byte, string, bool, map[string][]string) {
	if edited.Status > 0 {
		resp.StatusCode = edited.Status
		resp.Status = fmt.Sprintf("%d %s", resp.StatusCode, http.StatusText(resp.StatusCode))
	}
	resp.Header = http.Header(edited.ResponseHeaders).Clone()
	removeHopHeaders(resp.Header)
	body := []byte(edited.ResponseBody)
	resp.Body = io.NopCloser(bytes.NewReader(body))
	resp.ContentLength = int64(len(body))
	resp.Header.Set("Content-Length", fmt.Sprintf("%d", len(body)))
	return body, edited.ResponseBody, false, cloneHeader(resp.Header)
}

func requestFromEntry(entry TrafficEntry) (*http.Request, error) {
	if strings.TrimSpace(entry.URL) == "" {
		return nil, errors.New("request URL is required")
	}
	method := entry.Method
	if method == "" || entry.IsConnect {
		method = http.MethodGet
	}
	req, err := http.NewRequest(method, entry.URL, strings.NewReader(entry.RequestBody))
	if err != nil {
		return nil, err
	}
	req.Header = http.Header(entry.RequestHeaders).Clone()
	removeHopHeaders(req.Header)
	if entry.Host != "" {
		req.Host = entry.Host
	}
	return req, nil
}
