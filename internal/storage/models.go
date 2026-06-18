package storage

import (
	"time"

	"gorm.io/gorm"
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
