package storage

import (
	"encoding/json"
	"errors"
	"sort"
	"strconv"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func (s *Store) LoadAppState() (AppState, error) {
	if err := s.EnsureDefaultSession(); err != nil {
		return AppState{}, err
	}

	state := defaultAppState()
	if err := s.loadUIState(&state.UI); err != nil {
		return AppState{}, err
	}
	sessions, err := s.loadSessions()
	if err != nil {
		return AppState{}, err
	}
	pinnedIDs, err := s.loadPinnedIDs()
	if err != nil {
		return AppState{}, err
	}
	requestSessionIDs, err := s.loadRequestSessionIDs()
	if err != nil {
		return AppState{}, err
	}
	state.Sessions = sessions
	state.PinnedIDs = pinnedIDs
	state.RequestSessionIDs = requestSessionIDs
	return state, nil
}

func (s *Store) SaveAppState(state AppState) error {
	if err := s.EnsureDefaultSession(); err != nil {
		return err
	}
	if state.UI.ActiveSessionID == "" {
		state.UI.ActiveSessionID = DefaultSessionID
	}

	return db(s).Transaction(func(tx *gorm.DB) error {
		if err := saveUIState(tx, state.UI); err != nil {
			return err
		}
		keep, err := saveSessions(tx, state.Sessions)
		if err != nil {
			return err
		}
		if err := deleteDroppedSessions(tx, keep); err != nil {
			return err
		}
		if err := replacePins(tx, state.PinnedIDs); err != nil {
			return err
		}
		return saveTrafficAssignments(tx, state.RequestSessionIDs)
	})
}

func defaultAppState() AppState {
	return AppState{
		UI: UIState{
			IsDark:          true,
			LeftPanelWidth:  256,
			RightPanelWidth: 256,
			DetailsHeight:   320,
			ActiveSessionID: DefaultSessionID,
			Sort:            SortState{Key: "time", Direction: "desc"},
		},
		RequestSessionIDs: map[string]string{},
	}
}

func (s *Store) loadUIState(ui *UIState) error {
	var setting Setting
	err := db(s).First(&setting, "key = ?", uiStateKey).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	if err == nil && setting.Value != "" {
		_ = json.Unmarshal([]byte(setting.Value), ui)
	}
	return nil
}

func (s *Store) loadSessions() ([]SessionState, error) {
	var rows []Session
	if err := db(s).Order("created_at asc").Find(&rows).Error; err != nil {
		return nil, err
	}
	sort.SliceStable(rows, func(i, j int) bool {
		if rows[i].ID == DefaultSessionID {
			return true
		}
		if rows[j].ID == DefaultSessionID {
			return false
		}
		return rows[i].CreatedAt.Before(rows[j].CreatedAt)
	})

	sessions := make([]SessionState, 0, len(rows))
	for _, row := range rows {
		sessions = append(sessions, SessionState{ID: row.ID, Name: row.Name})
	}
	return sessions, nil
}

func (s *Store) loadPinnedIDs() ([]int64, error) {
	var pins []PinnedRequest
	if err := db(s).Order("created_at desc").Find(&pins).Error; err != nil {
		return nil, err
	}
	ids := make([]int64, 0, len(pins))
	for _, pin := range pins {
		ids = append(ids, pin.TrafficEntryID)
	}
	return ids, nil
}

func (s *Store) loadRequestSessionIDs() (map[string]string, error) {
	var entries []TrafficEntry
	if err := db(s).Select("id", "session_id").Find(&entries).Error; err != nil {
		return nil, err
	}
	ids := map[string]string{}
	for _, entry := range entries {
		ids[strconv.FormatInt(entry.ID, 10)] = entry.SessionID
	}
	return ids, nil
}

func saveUIState(tx *gorm.DB, ui UIState) error {
	value, err := json.Marshal(ui)
	if err != nil {
		return err
	}
	return tx.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "key"}},
		DoUpdates: clause.AssignmentColumns([]string{"value", "updated_at"}),
	}).Create(&Setting{Key: uiStateKey, Value: string(value)}).Error
}

func saveSessions(tx *gorm.DB, sessions []SessionState) (map[string]bool, error) {
	keep := map[string]bool{DefaultSessionID: true}
	if err := tx.Clauses(upsertColumns("name", "updated_at")).Create(defaultSession()).Error; err != nil {
		return nil, err
	}
	for _, session := range sessions {
		if session.ID == "" {
			continue
		}
		if session.ID == DefaultSessionID {
			session.Name = defaultSession().Name
		}
		keep[session.ID] = true
		row := Session{ID: session.ID, Name: session.Name}
		if err := tx.Clauses(upsertColumns("name", "updated_at")).Create(&row).Error; err != nil {
			return nil, err
		}
	}
	return keep, nil
}

func deleteDroppedSessions(tx *gorm.DB, keep map[string]bool) error {
	var sessions []Session
	if err := tx.Find(&sessions).Error; err != nil {
		return err
	}
	for _, session := range sessions {
		if keep[session.ID] {
			continue
		}
		if err := tx.Delete(&Session{}, "id = ?", session.ID).Error; err != nil {
			return err
		}
		if err := tx.Delete(&TrafficEntry{}, "session_id = ?", session.ID).Error; err != nil {
			return err
		}
	}
	return nil
}

func replacePins(tx *gorm.DB, ids []int64) error {
	if err := tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&PinnedRequest{}).Error; err != nil {
		return err
	}
	for _, id := range ids {
		if err := tx.Create(&PinnedRequest{TrafficEntryID: id}).Error; err != nil {
			return err
		}
	}
	return nil
}

func saveTrafficAssignments(tx *gorm.DB, requestSessionIDs map[string]string) error {
	keep := make(map[int64]bool, len(requestSessionIDs))
	for rawID, sessionID := range requestSessionIDs {
		id, err := strconv.ParseInt(rawID, 10, 64)
		if err != nil || sessionID == "" {
			continue
		}
		keep[id] = true
		if err := tx.Model(&TrafficEntry{}).Where("id = ?", id).Update("session_id", sessionID).Error; err != nil {
			return err
		}
	}
	return deleteDroppedTraffic(tx, keep)
}

func deleteDroppedTraffic(tx *gorm.DB, keep map[int64]bool) error {
	var entries []TrafficEntry
	if err := tx.Select("id").Find(&entries).Error; err != nil {
		return err
	}
	for _, entry := range entries {
		if keep[entry.ID] {
			continue
		}
		if err := tx.Delete(&TrafficEntry{}, "id = ?", entry.ID).Error; err != nil {
			return err
		}
		if err := tx.Delete(&PinnedRequest{}, "traffic_entry_id = ?", entry.ID).Error; err != nil {
			return err
		}
	}
	return nil
}
