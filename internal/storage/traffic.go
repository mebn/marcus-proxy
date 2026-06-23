package storage

import (
	"sort"

	captureproxy "marcus-proxy/internal/proxy"
)

type trafficRecord struct {
	SessionID string                    `json:"sessionId"`
	Entry     captureproxy.TrafficEntry `json:"entry"`
}

func (s *Store) SaveTrafficEntry(entry captureproxy.TrafficEntry) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	records, err := s.loadTrafficRecordsLocked()
	if err != nil {
		return err
	}

	for index, record := range records {
		if record.Entry.ID != entry.ID {
			continue
		}
		if record.SessionID == "" {
			record.SessionID = DefaultSessionID
		}
		record.Entry = entry
		records[index] = record
		return s.saveTrafficRecordsLocked(records)
	}

	records = append(records, trafficRecord{
		SessionID: DefaultSessionID,
		Entry:     entry,
	})
	return s.saveTrafficRecordsLocked(records)
}

func (s *Store) LoadTrafficEntries() ([]captureproxy.TrafficEntry, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	records, err := s.loadTrafficRecordsLocked()
	if err != nil {
		return nil, err
	}

	sort.SliceStable(records, func(i, j int) bool {
		return records[i].Entry.ID > records[j].Entry.ID
	})

	entries := make([]captureproxy.TrafficEntry, 0, len(records))
	for _, record := range records {
		entries = append(entries, record.Entry)
	}
	return entries, nil
}

func (s *Store) loadTrafficRecordsLocked() ([]trafficRecord, error) {
	return readJSON(s.trafficPath, []trafficRecord{})
}

func (s *Store) saveTrafficRecordsLocked(records []trafficRecord) error {
	if records == nil {
		records = []trafficRecord{}
	}
	sort.SliceStable(records, func(i, j int) bool {
		return records[i].Entry.ID > records[j].Entry.ID
	})
	return writeJSON(s.trafficPath, records)
}
