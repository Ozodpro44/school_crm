package db

import (
	"os"
	"path/filepath"
	"regexp"
	"testing"
)

// golang-migrate refuses to start ("duplicate migration file") when two files
// share a version, which crash-looped the monolith when a migration was added
// under an already used number. Every version must have exactly one .up.sql
// and one .down.sql.
func TestMigrationVersionsAreUnique(t *testing.T) {
	dir := filepath.Join("..", "..", "migrations")
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	re := regexp.MustCompile(`^(\d+)_(.+)\.(up|down)\.sql$`)
	type pair struct{ up, down []string }
	byVersion := map[string]*pair{}
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		m := re.FindStringSubmatch(e.Name())
		if m == nil {
			t.Errorf("unexpected file in migrations/: %s", e.Name())
			continue
		}
		p := byVersion[m[1]]
		if p == nil {
			p = &pair{}
			byVersion[m[1]] = p
		}
		if m[3] == "up" {
			p.up = append(p.up, e.Name())
		} else {
			p.down = append(p.down, e.Name())
		}
	}
	for v, p := range byVersion {
		if len(p.up) != 1 || len(p.down) != 1 {
			t.Errorf("migration version %s must have exactly one up and one down file, got up=%v down=%v", v, p.up, p.down)
		}
	}
}
