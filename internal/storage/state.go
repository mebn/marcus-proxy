package storage

import (
	"strconv"
)

func (s *Store) LoadAppState() (AppState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	state, err := readJSON(s.statePath, defaultAppState())
	if err != nil {
		return AppState{}, err
	}
	return normalizeAppState(state), nil
}

func (s *Store) SaveAppState(state AppState) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	state = normalizeAppState(state)
	records, err := s.loadTrafficRecordsLocked()
	if err != nil {
		return err
	}
	records = applyTrafficAssignments(records, state.RequestSessionIDs)
	if err := s.saveTrafficRecordsLocked(records); err != nil {
		return err
	}
	return writeJSON(s.statePath, state)
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
		Sessions:          []SessionState{defaultSession()},
		RequestSessionIDs: map[string]string{},
	}
}

func normalizeAppState(state AppState) AppState {
	if state.UI.ActiveSessionID == "" {
		state.UI.ActiveSessionID = DefaultSessionID
	}
	if state.RequestSessionIDs == nil {
		state.RequestSessionIDs = map[string]string{}
	}
	state.Sessions = normalizeSessions(state.Sessions)
	return state
}

func normalizeSessions(sessions []SessionState) []SessionState {
	normalized := []SessionState{defaultSession()}
	seen := map[string]bool{DefaultSessionID: true}
	for _, session := range sessions {
		if session.ID == "" || seen[session.ID] {
			continue
		}
		seen[session.ID] = true
		normalized = append(normalized, session)
	}
	return normalized
}

func applyTrafficAssignments(
	records []trafficRecord,
	requestSessionIDs map[string]string,
) []trafficRecord {
	if len(requestSessionIDs) == 0 {
		return []trafficRecord{}
	}

	next := make([]trafficRecord, 0, len(records))
	for _, record := range records {
		id := strconv.FormatInt(record.Entry.ID, 10)
		sessionID := requestSessionIDs[id]
		if sessionID == "" {
			continue
		}
		record.SessionID = sessionID
		next = append(next, record)
	}
	return next
}
