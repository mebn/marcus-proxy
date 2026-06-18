package storage

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"time"

	captureproxy "marcus-proxy/internal/proxy"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	DefaultSessionID = "default"
	uiStateKey       = "ui_state"
)

type Store struct {
	db *gorm.DB
}

type Session struct {
	ID        string `json:"id" gorm:"primaryKey"`
	Name      string `json:"name"`
	CreatedAt time.Time
	UpdatedAt time.Time
}

type SessionState struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type TrafficEntry struct {
	ID                    int64  `gorm:"primaryKey"`
	SessionID             string `gorm:"index;default:default"`
	Time                  string
	Method                string
	URL                   string
	Host                  string `gorm:"index"`
	Status                int
	Bytes                 int64
	DurationMs            int64
	Client                string
	Error                 string
	IsConnect             bool
	RequestBytes          int64
	RequestHeaders        string
	ResponseHeaders       string
	RequestBody           string
	ResponseBody          string
	RequestBodyTruncated  bool
	ResponseBodyTruncated bool
	CreatedAt             time.Time
	UpdatedAt             time.Time
}

type PinnedRequest struct {
	TrafficEntryID int64 `json:"trafficEntryId" gorm:"primaryKey"`
	CreatedAt      time.Time
}

type Setting struct {
	Key       string `gorm:"primaryKey"`
	Value     string
	UpdatedAt time.Time
}

type SortState struct {
	Key       string `json:"key"`
	Direction string `json:"direction"`
}

type UIState struct {
	IsDark             bool      `json:"isDark"`
	LeftPanelOpen      bool      `json:"leftPanelOpen"`
	RightPanelOpen     bool      `json:"rightPanelOpen"`
	DetailsOpen        bool      `json:"detailsOpen"`
	LeftPanelWidth     float64   `json:"leftPanelWidth"`
	RightPanelWidth    float64   `json:"rightPanelWidth"`
	DetailsHeight      float64   `json:"detailsHeight"`
	Filter             string    `json:"filter"`
	HostFilter         *string   `json:"hostFilter"`
	MethodFilters      []string  `json:"methodFilters"`
	ContentTypeFilters []string  `json:"contentTypeFilters"`
	ActiveSessionID    string    `json:"activeSessionId"`
	Sort               SortState `json:"sort"`
}

type AppState struct {
	UI                UIState           `json:"ui"`
	Sessions          []SessionState    `json:"sessions"`
	PinnedIDs         []int64           `json:"pinnedIds"`
	RequestSessionIDs map[string]string `json:"requestSessionIds"`
}

func Open() (*Store, error) {
	dir, err := os.UserConfigDir()
	if err != nil || dir == "" {
		dir = os.TempDir()
	}
	dir = filepath.Join(dir, "marcus-proxy")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, err
	}

	db, err := gorm.Open(sqlite.Open(filepath.Join(dir, "app.db")), &gorm.Config{})
	if err != nil {
		return nil, err
	}
	if err := db.AutoMigrate(&Session{}, &TrafficEntry{}, &PinnedRequest{}, &Setting{}); err != nil {
		return nil, err
	}

	store := &Store{db: db}
	return store, store.EnsureDefaultSession()
}

func (s *Store) EnsureDefaultSession() error {
	return s.db.Clauses(clause.OnConflict{DoNothing: true}).Create(&Session{
		ID:   DefaultSessionID,
		Name: "Quick session",
	}).Error
}

func (s *Store) LoadAppState() (AppState, error) {
	if err := s.EnsureDefaultSession(); err != nil {
		return AppState{}, err
	}

	state := AppState{
		UI: UIState{
			IsDark:          true,
			LeftPanelWidth:  256,
			RightPanelWidth: 256,
			DetailsHeight:   320,
			ActiveSessionID: DefaultSessionID,
			Sort: SortState{
				Key:       "time",
				Direction: "desc",
			},
		},
		RequestSessionIDs: map[string]string{},
	}

	var setting Setting
	if err := s.db.First(&setting, "key = ?", uiStateKey).Error; err == nil && setting.Value != "" {
		_ = json.Unmarshal([]byte(setting.Value), &state.UI)
	} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return AppState{}, err
	}

	var sessions []Session
	if err := s.db.Order("created_at asc").Find(&sessions).Error; err != nil {
		return AppState{}, err
	}
	sort.SliceStable(sessions, func(i, j int) bool {
		if sessions[i].ID == DefaultSessionID {
			return true
		}
		if sessions[j].ID == DefaultSessionID {
			return false
		}
		return sessions[i].CreatedAt.Before(sessions[j].CreatedAt)
	})
	for _, session := range sessions {
		state.Sessions = append(state.Sessions, SessionState{
			ID:   session.ID,
			Name: session.Name,
		})
	}

	var pins []PinnedRequest
	if err := s.db.Order("created_at desc").Find(&pins).Error; err != nil {
		return AppState{}, err
	}
	for _, pin := range pins {
		state.PinnedIDs = append(state.PinnedIDs, pin.TrafficEntryID)
	}

	var entries []TrafficEntry
	if err := s.db.Select("id", "session_id").Find(&entries).Error; err != nil {
		return AppState{}, err
	}
	for _, entry := range entries {
		state.RequestSessionIDs[strconv.FormatInt(entry.ID, 10)] = entry.SessionID
	}

	return state, nil
}

func (s *Store) SaveAppState(state AppState) error {
	if err := s.EnsureDefaultSession(); err != nil {
		return err
	}
	if state.UI.ActiveSessionID == "" {
		state.UI.ActiveSessionID = DefaultSessionID
	}

	return s.db.Transaction(func(tx *gorm.DB) error {
		ui, err := json.Marshal(state.UI)
		if err != nil {
			return err
		}
		if err := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "key"}},
			DoUpdates: clause.AssignmentColumns([]string{"value", "updated_at"}),
		}).Create(&Setting{Key: uiStateKey, Value: string(ui)}).Error; err != nil {
			return err
		}

		keep := map[string]bool{DefaultSessionID: true}
		if err := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "id"}},
			DoUpdates: clause.AssignmentColumns([]string{"name", "updated_at"}),
		}).Create(&Session{ID: DefaultSessionID, Name: "Quick session"}).Error; err != nil {
			return err
		}
		for _, session := range state.Sessions {
			if session.ID == "" {
				continue
			}
			keep[session.ID] = true
			if session.ID == DefaultSessionID {
				session.Name = "Quick session"
			}
			if err := tx.Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "id"}},
				DoUpdates: clause.AssignmentColumns([]string{"name", "updated_at"}),
			}).Create(&Session{ID: session.ID, Name: session.Name}).Error; err != nil {
				return err
			}
		}
		var sessions []Session
		if err := tx.Find(&sessions).Error; err != nil {
			return err
		}
		for _, session := range sessions {
			if !keep[session.ID] {
				if err := tx.Delete(&Session{}, "id = ?", session.ID).Error; err != nil {
					return err
				}
				if err := tx.Delete(&TrafficEntry{}, "session_id = ?", session.ID).Error; err != nil {
					return err
				}
			}
		}

		if err := tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&PinnedRequest{}).Error; err != nil {
			return err
		}
		for _, id := range state.PinnedIDs {
			if err := tx.Create(&PinnedRequest{TrafficEntryID: id}).Error; err != nil {
				return err
			}
		}

		trafficIDs := make(map[int64]bool, len(state.RequestSessionIDs))
		for rawID, sessionID := range state.RequestSessionIDs {
			id, err := strconv.ParseInt(rawID, 10, 64)
			if err != nil || sessionID == "" {
				continue
			}
			trafficIDs[id] = true
			if err := tx.Model(&TrafficEntry{}).Where("id = ?", id).Update("session_id", sessionID).Error; err != nil {
				return err
			}
		}
		var entries []TrafficEntry
		if err := tx.Select("id").Find(&entries).Error; err != nil {
			return err
		}
		for _, entry := range entries {
			if !trafficIDs[entry.ID] {
				if err := tx.Delete(&TrafficEntry{}, "id = ?", entry.ID).Error; err != nil {
					return err
				}
				if err := tx.Delete(&PinnedRequest{}, "traffic_entry_id = ?", entry.ID).Error; err != nil {
					return err
				}
			}
		}

		return nil
	})
}

func (s *Store) SaveTrafficEntry(entry captureproxy.TrafficEntry) error {
	model, err := trafficModelFromProxy(entry, DefaultSessionID)
	if err != nil {
		return err
	}
	return s.db.Clauses(clause.OnConflict{
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
	if err := s.db.Order("id desc").Find(&rows).Error; err != nil {
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
	var requestHeaders map[string][]string
	var responseHeaders map[string][]string
	if e.RequestHeaders != "" {
		if err := json.Unmarshal([]byte(e.RequestHeaders), &requestHeaders); err != nil {
			return captureproxy.TrafficEntry{}, err
		}
	}
	if e.ResponseHeaders != "" {
		if err := json.Unmarshal([]byte(e.ResponseHeaders), &responseHeaders); err != nil {
			return captureproxy.TrafficEntry{}, err
		}
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
