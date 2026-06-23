package storage

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
)

func Open() (*Store, error) {
	dir, err := os.UserConfigDir()
	if err != nil || dir == "" {
		dir = os.TempDir()
	}
	dir = filepath.Join(dir, "marcus-proxy")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, err
	}

	return &Store{
		statePath:   filepath.Join(dir, "app_state.json"),
		trafficPath: filepath.Join(dir, "traffic.json"),
	}, nil
}

func defaultSession() SessionState {
	return SessionState{ID: DefaultSessionID, Name: "Quick session"}
}

func readJSON[T any](path string, fallback T) (T, error) {
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return fallback, nil
	}
	if err != nil {
		return fallback, err
	}
	if len(data) == 0 {
		return fallback, nil
	}
	if err := json.Unmarshal(data, &fallback); err != nil {
		return fallback, err
	}
	return fallback, nil
}

func writeJSON(path string, value any) error {
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	data = append(data, '\n')

	tmp, err := os.CreateTemp(filepath.Dir(path), "."+filepath.Base(path)+".tmp-*")
	if err != nil {
		return err
	}
	tmpPath := tmp.Name()
	defer func() {
		_ = os.Remove(tmpPath)
	}()

	if _, err := tmp.Write(data); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmpPath, path)
}
