package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/golang-migrate/migrate/v4"
	pgmigrate "github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	_ "github.com/lib/pq"

	"github.com/vexil-platform/vexil/internal/apiserver/store/migrations"
)

// PostgresStore implements Store backed by PostgreSQL.
type PostgresStore struct {
	db *sql.DB
}

// NewPostgresStore connects to PostgreSQL (with retries) and runs pending migrations.
func NewPostgresStore(databaseURL string) (*PostgresStore, error) {
	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	// Retry connection — PostgreSQL may still be starting up in Kubernetes
	const maxRetries = 10
	for i := range maxRetries {
		if err = db.Ping(); err == nil {
			break
		}
		slog.Warn("waiting for database", "attempt", i+1, "error", err)
		time.Sleep(2 * time.Second)
	}
	if err != nil {
		db.Close()
		return nil, fmt.Errorf("ping database after %d retries: %w", maxRetries, err)
	}

	if err := runMigrations(db); err != nil {
		db.Close()
		return nil, fmt.Errorf("run migrations: %w", err)
	}

	slog.Info("connected to PostgreSQL and migrations applied")
	return &PostgresStore{db: db}, nil
}

func runMigrations(db *sql.DB) error {
	source, err := iofs.New(migrations.FS, ".")
	if err != nil {
		return fmt.Errorf("create migration source: %w", err)
	}

	driver, err := pgmigrate.WithInstance(db, &pgmigrate.Config{})
	if err != nil {
		return fmt.Errorf("create migration driver: %w", err)
	}

	m, err := migrate.NewWithInstance("iofs", source, "postgres", driver)
	if err != nil {
		return fmt.Errorf("create migrator: %w", err)
	}

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("apply migrations: %w", err)
	}

	return nil
}

func (s *PostgresStore) RecordAudit(ctx context.Context, event AuditEvent) error {
	diffJSON, err := json.Marshal(event.Diff)
	if err != nil {
		return err
	}
	metaJSON, err := json.Marshal(event.Metadata)
	if err != nil {
		return err
	}

	_, err = s.db.ExecContext(ctx,
		`INSERT INTO audit_events (actor, action, resource, resource_id, cluster, diff, metadata)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		event.Actor, event.Action, event.Resource, event.ResourceID, event.Cluster,
		diffJSON, metaJSON,
	)
	return err
}

func (s *PostgresStore) ListAuditEvents(ctx context.Context, filter AuditFilter) ([]AuditEvent, error) {
	query := `SELECT id, timestamp, actor, action, resource, resource_id, cluster, diff, metadata
	          FROM audit_events WHERE 1=1`
	var args []interface{}
	argN := 1

	if filter.Resource != "" {
		query += fmt.Sprintf(" AND resource = $%d", argN)
		args = append(args, filter.Resource)
		argN++
	}
	if filter.ResourceID != "" {
		query += fmt.Sprintf(" AND resource_id = $%d", argN)
		args = append(args, filter.ResourceID)
		argN++
	}
	if filter.Action != "" {
		query += fmt.Sprintf(" AND action = $%d", argN)
		args = append(args, filter.Action)
		argN++
	}
	if filter.Cluster != "" {
		query += fmt.Sprintf(" AND cluster = $%d", argN)
		args = append(args, filter.Cluster)
		argN++
	}
	if filter.Actor != "" {
		query += fmt.Sprintf(" AND actor = $%d", argN)
		args = append(args, filter.Actor)
		argN++
	}
	if filter.Since != nil {
		query += fmt.Sprintf(" AND timestamp >= $%d", argN)
		args = append(args, *filter.Since)
		argN++
	}

	query += " ORDER BY timestamp DESC"

	if filter.Limit > 0 {
		query += fmt.Sprintf(" LIMIT $%d", argN)
		args = append(args, filter.Limit)
	}

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []AuditEvent
	for rows.Next() {
		var e AuditEvent
		var cluster sql.NullString
		var diffJSON, metaJSON []byte

		if err := rows.Scan(&e.ID, &e.Timestamp, &e.Actor, &e.Action, &e.Resource,
			&e.ResourceID, &cluster, &diffJSON, &metaJSON); err != nil {
			return nil, err
		}
		e.Cluster = cluster.String
		if diffJSON != nil {
			json.Unmarshal(diffJSON, &e.Diff)
		}
		if metaJSON != nil {
			json.Unmarshal(metaJSON, &e.Metadata)
		}
		events = append(events, e)
	}
	return events, rows.Err()
}

func (s *PostgresStore) GetUserByUsername(ctx context.Context, username string) (*User, error) {
	var u User
	err := s.db.QueryRowContext(ctx,
		`SELECT id, username, password_hash, role, created_at FROM users WHERE username = $1`,
		username,
	).Scan(&u.ID, &u.Username, &u.PasswordHash, &u.Role, &u.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("user not found: %s", username)
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (s *PostgresStore) UpdatePassword(ctx context.Context, username string, passwordHash string) error {
	res, err := s.db.ExecContext(ctx,
		`UPDATE users SET password_hash = $1 WHERE username = $2`,
		passwordHash, username,
	)
	if err != nil {
		return err
	}
	return checkRowAffected(res, username)
}

func (s *PostgresStore) CreateUser(ctx context.Context, user User) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)`,
		user.Username, user.PasswordHash, user.Role,
	)
	if err != nil && strings.Contains(err.Error(), "duplicate key") {
		return fmt.Errorf("user already exists: %s", user.Username)
	}
	return err
}

func (s *PostgresStore) ListUsers(ctx context.Context) ([]User, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, username, role, created_at FROM users ORDER BY username`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Username, &u.Role, &u.CreatedAt); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

func (s *PostgresStore) DeleteUser(ctx context.Context, username string) error {
	res, err := s.db.ExecContext(ctx,
		`DELETE FROM users WHERE username = $1`, username)
	if err != nil {
		return err
	}
	return checkRowAffected(res, username)
}

func (s *PostgresStore) UpdateUserRole(ctx context.Context, username string, role string) error {
	res, err := s.db.ExecContext(ctx,
		`UPDATE users SET role = $1 WHERE username = $2`,
		role, username,
	)
	if err != nil {
		return err
	}
	return checkRowAffected(res, username)
}

func (s *PostgresStore) Close() error {
	return s.db.Close()
}

func checkRowAffected(res sql.Result, username string) error {
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return fmt.Errorf("user not found: %s", username)
	}
	return nil
}
