package storage

import (
	"sync"
)

const DefaultSessionID = "default"

type Store struct {
	mu          sync.Mutex
	statePath   string
	trafficPath string
}

type SessionState struct {
	ID   string `json:"id"`
	Name string `json:"name"`
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
