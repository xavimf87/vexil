package store

import (
	"context"
	"time"
)

// AuditEvent represents an audit log entry.
type AuditEvent struct {
	ID         string                 `json:"id"`
	Timestamp  time.Time              `json:"timestamp"`
	Actor      string                 `json:"actor,omitempty"`
	Action     string                 `json:"action"`
	Resource   string                 `json:"resource"`
	ResourceID string                 `json:"resourceId"`
	Cluster    string                 `json:"cluster,omitempty"`
	Diff       map[string]interface{} `json:"diff,omitempty"`
	Metadata   map[string]string      `json:"metadata,omitempty"`
}

// AuditFilter defines filters for querying audit events.
type AuditFilter struct {
	Resource   string
	ResourceID string
	Action     string
	Cluster    string
	Actor      string
	Since      *time.Time
	Limit      int
}

// User represents an authenticated user.
type User struct {
	ID           string    `json:"id"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"-"`
	Role         string    `json:"role"`
	CreatedAt    time.Time `json:"createdAt"`
}

// Store defines the persistence interface for the API server.
type Store interface {
	// RecordAudit persists an audit event.
	RecordAudit(ctx context.Context, event AuditEvent) error

	// ListAuditEvents queries audit events with filters.
	ListAuditEvents(ctx context.Context, filter AuditFilter) ([]AuditEvent, error)

	// GetUserByUsername returns a user by username.
	GetUserByUsername(ctx context.Context, username string) (*User, error)

	// UpdatePassword updates a user's password hash.
	UpdatePassword(ctx context.Context, username string, passwordHash string) error

	// CreateUser creates a new user.
	CreateUser(ctx context.Context, user User) error

	// ListUsers returns all users.
	ListUsers(ctx context.Context) ([]User, error)

	// DeleteUser deletes a user by username.
	DeleteUser(ctx context.Context, username string) error

	// UpdateUserRole updates a user's role.
	UpdateUserRole(ctx context.Context, username string, role string) error

	// Close closes the store connection.
	Close() error
}
