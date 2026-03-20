package store

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"
)

// MemoryStore is an in-memory implementation of Store for development.
type MemoryStore struct {
	mu     sync.RWMutex
	events []AuditEvent
	users  map[string]User
}

// NewMemoryStore creates a new in-memory store.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		events: make([]AuditEvent, 0),
		users:  make(map[string]User),
	}
}

func (s *MemoryStore) RecordAudit(_ context.Context, event AuditEvent) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	event.ID = uuid.New().String()
	event.Timestamp = time.Now()

	s.events = append(s.events, event)
	return nil
}

func (s *MemoryStore) ListAuditEvents(_ context.Context, filter AuditFilter) ([]AuditEvent, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []AuditEvent
	for _, e := range s.events {
		if filter.Resource != "" && e.Resource != filter.Resource {
			continue
		}
		if filter.ResourceID != "" && e.ResourceID != filter.ResourceID {
			continue
		}
		if filter.Action != "" && e.Action != filter.Action {
			continue
		}
		if filter.Cluster != "" && e.Cluster != filter.Cluster {
			continue
		}
		if filter.Actor != "" && e.Actor != filter.Actor {
			continue
		}
		if filter.Since != nil && e.Timestamp.Before(*filter.Since) {
			continue
		}
		result = append(result, e)
	}

	// Return in reverse chronological order
	for i, j := 0, len(result)-1; i < j; i, j = i+1, j-1 {
		result[i], result[j] = result[j], result[i]
	}

	if filter.Limit > 0 && len(result) > filter.Limit {
		result = result[:filter.Limit]
	}

	return result, nil
}

func (s *MemoryStore) GetUserByUsername(_ context.Context, username string) (*User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	user, ok := s.users[username]
	if !ok {
		return nil, fmt.Errorf("user not found: %s", username)
	}
	return &user, nil
}

func (s *MemoryStore) UpdatePassword(_ context.Context, username string, passwordHash string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	user, ok := s.users[username]
	if !ok {
		return fmt.Errorf("user not found: %s", username)
	}
	user.PasswordHash = passwordHash
	s.users[username] = user
	return nil
}

func (s *MemoryStore) CreateUser(_ context.Context, user User) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.users[user.Username]; exists {
		return fmt.Errorf("user already exists: %s", user.Username)
	}
	if user.ID == "" {
		user.ID = uuid.New().String()
	}
	if user.CreatedAt.IsZero() {
		user.CreatedAt = time.Now()
	}
	s.users[user.Username] = user
	return nil
}

func (s *MemoryStore) ListUsers(_ context.Context) ([]User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	users := make([]User, 0, len(s.users))
	for _, u := range s.users {
		u.PasswordHash = ""
		users = append(users, u)
	}
	sort.Slice(users, func(i, j int) bool {
		return users[i].Username < users[j].Username
	})
	return users, nil
}

func (s *MemoryStore) DeleteUser(_ context.Context, username string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.users[username]; !ok {
		return fmt.Errorf("user not found: %s", username)
	}
	delete(s.users, username)
	return nil
}

func (s *MemoryStore) UpdateUserRole(_ context.Context, username string, role string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	user, ok := s.users[username]
	if !ok {
		return fmt.Errorf("user not found: %s", username)
	}
	user.Role = role
	s.users[username] = user
	return nil
}

func (s *MemoryStore) Close() error {
	return nil
}
