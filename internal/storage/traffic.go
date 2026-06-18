package storage

import (
	"encoding/json"

	captureproxy "marcus-proxy/internal/proxy"

	"gorm.io/gorm/clause"
)

func (s *Store) SaveTrafficEntry(entry captureproxy.TrafficEntry) error {
	model, err := trafficModelFromProxy(entry, DefaultSessionID)
	if err != nil {
		return err
	}
	return db(s).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"session_id",
			"time",
			"method",
			"url",
			"host",
			"status",
			"bytes",
			"duration_ms",
			"client",
			"error",
			"is_connect",
			"request_bytes",
			"request_headers",
			"response_headers",
			"request_body",
			"response_body",
			"request_body_truncated",
			"response_body_truncated",
			"updated_at",
		}),
	}).Create(&model).Error
}

func (s *Store) LoadTrafficEntries() ([]captureproxy.TrafficEntry, error) {
	var rows []TrafficEntry
	if err := db(s).Order("id desc").Find(&rows).Error; err != nil {
		return nil, err
	}

	entries := make([]captureproxy.TrafficEntry, 0, len(rows))
	for _, row := range rows {
		entry, err := row.toProxy()
		if err != nil {
			return nil, err
		}
		entries = append(entries, entry)
	}
	return entries, nil
}

func trafficModelFromProxy(entry captureproxy.TrafficEntry, sessionID string) (TrafficEntry, error) {
	requestHeaders, err := json.Marshal(entry.RequestHeaders)
	if err != nil {
		return TrafficEntry{}, err
	}
	responseHeaders, err := json.Marshal(entry.ResponseHeaders)
	if err != nil {
		return TrafficEntry{}, err
	}
	if sessionID == "" {
		sessionID = DefaultSessionID
	}

	return TrafficEntry{
		ID:                    entry.ID,
		SessionID:             sessionID,
		Time:                  entry.Time,
		Method:                entry.Method,
		URL:                   entry.URL,
		Host:                  entry.Host,
		Status:                entry.Status,
		Bytes:                 entry.Bytes,
		DurationMs:            entry.DurationMs,
		Client:                entry.Client,
		Error:                 entry.Error,
		IsConnect:             entry.IsConnect,
		RequestBytes:          entry.RequestBytes,
		RequestHeaders:        string(requestHeaders),
		ResponseHeaders:       string(responseHeaders),
		RequestBody:           entry.RequestBody,
		ResponseBody:          entry.ResponseBody,
		RequestBodyTruncated:  entry.RequestBodyTruncated,
		ResponseBodyTruncated: entry.ResponseBodyTruncated,
	}, nil
}

func (e TrafficEntry) toProxy() (captureproxy.TrafficEntry, error) {
	requestHeaders, err := unmarshalHeaders(e.RequestHeaders)
	if err != nil {
		return captureproxy.TrafficEntry{}, err
	}
	responseHeaders, err := unmarshalHeaders(e.ResponseHeaders)
	if err != nil {
		return captureproxy.TrafficEntry{}, err
	}

	return captureproxy.TrafficEntry{
		ID:                    e.ID,
		Time:                  e.Time,
		Method:                e.Method,
		URL:                   e.URL,
		Host:                  e.Host,
		Status:                e.Status,
		Bytes:                 e.Bytes,
		DurationMs:            e.DurationMs,
		Client:                e.Client,
		Error:                 e.Error,
		IsConnect:             e.IsConnect,
		RequestBytes:          e.RequestBytes,
		RequestHeaders:        requestHeaders,
		ResponseHeaders:       responseHeaders,
		RequestBody:           e.RequestBody,
		ResponseBody:          e.ResponseBody,
		RequestBodyTruncated:  e.RequestBodyTruncated,
		ResponseBodyTruncated: e.ResponseBodyTruncated,
	}, nil
}

func unmarshalHeaders(raw string) (map[string][]string, error) {
	var headers map[string][]string
	if raw == "" {
		return headers, nil
	}
	err := json.Unmarshal([]byte(raw), &headers)
	return headers, err
}
