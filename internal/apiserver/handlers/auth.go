package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/vexil-platform/vexil/internal/apiserver/middleware"
	"github.com/vexil-platform/vexil/internal/apiserver/store"
)

const tokenExpiry = 24 * time.Hour

type session struct {
	Username  string
	Role      string
	ExpiresAt time.Time
}

// AuthHandler handles authentication API requests.
type AuthHandler struct {
	store    store.Store
	mu       sync.RWMutex
	sessions map[string]session
}

// NewAuthHandler creates a new AuthHandler.
func NewAuthHandler(st store.Store) *AuthHandler {
	return &AuthHandler{
		store:    st,
		sessions: make(map[string]session),
	}
}

// ValidateToken checks if a token is valid and returns the username and role.
// This implements the TokenValidator interface used by the auth middleware.
func (h *AuthHandler) ValidateToken(token string) (username string, role string, ok bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	sess, exists := h.sessions[token]
	if !exists {
		return "", "", false
	}
	if time.Now().After(sess.ExpiresAt) {
		return "", "", false
	}
	return sess.Username, sess.Role, true
}

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type loginResponse struct {
	Token string     `json:"token"`
	User  meResponse `json:"user"`
}

type meResponse struct {
	Username string `json:"username"`
	Role     string `json:"role"`
}

// Login handles POST /api/v1/auth/login.
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Username == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "username and password are required")
		return
	}

	user, err := h.store.GetUserByUsername(r.Context(), req.Username)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	token, err := generateToken()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to generate token")
		return
	}

	h.mu.Lock()
	h.sessions[token] = session{
		Username:  user.Username,
		Role:      user.Role,
		ExpiresAt: time.Now().Add(tokenExpiry),
	}
	h.mu.Unlock()

	writeJSON(w, http.StatusOK, loginResponse{
		Token: token,
		User:  meResponse{Username: user.Username, Role: user.Role},
	})
}

// Logout handles POST /api/v1/auth/logout.
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	token := extractBearerToken(r)
	if token == "" {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	h.mu.Lock()
	delete(h.sessions, token)
	h.mu.Unlock()

	writeJSON(w, http.StatusOK, map[string]string{"message": "logged out"})
}

// Me handles GET /api/v1/auth/me.
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	token := extractBearerToken(r)
	if token == "" {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	username, role, ok := h.ValidateToken(token)
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	writeJSON(w, http.StatusOK, meResponse{Username: username, Role: role})
}

// ListUsers handles GET /api/v1/users.
func (h *AuthHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.store.ListUsers(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list users")
		return
	}
	writeJSON(w, http.StatusOK, users)
}

type createUserRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

// CreateUser handles POST /api/v1/users.
func (h *AuthHandler) CreateUser(w http.ResponseWriter, r *http.Request) {
	_, role := middleware.UserFromContext(r.Context())
	if role != "admin" {
		writeError(w, http.StatusForbidden, "only admins can create users")
		return
	}

	var req createUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Username == "" || req.Password == "" || req.Role == "" {
		writeError(w, http.StatusBadRequest, "username, password, and role are required")
		return
	}

	if req.Role != "admin" && req.Role != "editor" && req.Role != "viewer" {
		writeError(w, http.StatusBadRequest, "role must be admin, editor, or viewer")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to hash password")
		return
	}

	user := store.User{
		Username:     req.Username,
		PasswordHash: string(hash),
		Role:         req.Role,
	}
	if err := h.store.CreateUser(r.Context(), user); err != nil {
		writeError(w, http.StatusConflict, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, map[string]string{
		"username": req.Username,
		"role":     req.Role,
	})
}

type updateUserRequest struct {
	Password string `json:"password,omitempty"`
	Role     string `json:"role,omitempty"`
}

// UpdateUser handles PUT /api/v1/users/{username}.
func (h *AuthHandler) UpdateUser(w http.ResponseWriter, r *http.Request) {
	targetUsername := r.PathValue("username")
	currentUsername, currentRole := middleware.UserFromContext(r.Context())

	var req updateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	isAdmin := currentRole == "admin"
	isSelf := currentUsername == targetUsername

	// Non-admins can only update their own password
	if !isAdmin {
		if !isSelf {
			writeError(w, http.StatusForbidden, "you can only update your own account")
			return
		}
		if req.Role != "" {
			writeError(w, http.StatusForbidden, "only admins can change roles")
			return
		}
	}

	if req.Role != "" {
		if req.Role != "admin" && req.Role != "editor" && req.Role != "viewer" {
			writeError(w, http.StatusBadRequest, "role must be admin, editor, or viewer")
			return
		}
		if err := h.store.UpdateUserRole(r.Context(), targetUsername, req.Role); err != nil {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
	}

	if req.Password != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to hash password")
			return
		}
		if err := h.store.UpdatePassword(r.Context(), targetUsername, string(hash)); err != nil {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "user updated"})
}

// DeleteUser handles DELETE /api/v1/users/{username}.
func (h *AuthHandler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	targetUsername := r.PathValue("username")
	currentUsername, currentRole := middleware.UserFromContext(r.Context())

	if currentRole != "admin" {
		writeError(w, http.StatusForbidden, "only admins can delete users")
		return
	}

	if currentUsername == targetUsername {
		writeError(w, http.StatusBadRequest, "cannot delete yourself")
		return
	}

	if err := h.store.DeleteUser(r.Context(), targetUsername); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "user deleted"})
}

func extractBearerToken(r *http.Request) string {
	auth := r.Header.Get("Authorization")
	if len(auth) > 7 && auth[:7] == "Bearer " {
		return auth[7:]
	}
	return ""
}

func generateToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
