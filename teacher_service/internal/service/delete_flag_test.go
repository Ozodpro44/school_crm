package service

import (
	"context"
	"testing"
)

// The column name is interpolated into SQL, so anything outside the
// whitelist must be rejected before the database is touched (nil db here).
func TestHasDeleteFlag_RejectsUnknownColumn(t *testing.T) {
	s := &TeacherService{}
	for _, col := range []string{"", "id", "can_view_students; DROP TABLE users", "can_delete_students--"} {
		if ok, err := s.HasDeleteFlag(context.Background(), "u1", col); err == nil || ok {
			t.Errorf("column %q: want error and false, got ok=%v err=%v", col, ok, err)
		}
	}
}

func TestHasDeleteFlag_NoUserIsFalse(t *testing.T) {
	s := &TeacherService{}
	for col := range deleteFlagColumns {
		if ok, err := s.HasDeleteFlag(context.Background(), "", col); ok || err != nil {
			t.Errorf("empty user for %q: got ok=%v err=%v", col, ok, err)
		}
	}
}
