package storage

import (
	"os"
	"path/filepath"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
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
	return s.db.Clauses(clause.OnConflict{DoNothing: true}).Create(defaultSession()).Error
}

func defaultSession() *Session {
	return &Session{ID: DefaultSessionID, Name: "Quick session"}
}

func upsertColumns(columns ...string) clause.OnConflict {
	return clause.OnConflict{
		Columns:   []clause.Column{{Name: "id"}},
		DoUpdates: clause.AssignmentColumns(columns),
	}
}

func db(s *Store) *gorm.DB {
	return s.db
}
