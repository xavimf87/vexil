package handlers

import (
	"net/http"

	"github.com/vexil-platform/vexil/internal/apiserver/store"
)

// AuditHandler handles audit log API requests.
type AuditHandler struct {
	store store.Store
}

// NewAuditHandler creates a new AuditHandler.
func NewAuditHandler(st store.Store) *AuditHandler {
	return &AuditHandler{store: st}
}

// List returns audit events with optional filtering.
func (h *AuditHandler) List(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	filter := store.AuditFilter{
		Resource:   r.URL.Query().Get("resource"),
		ResourceID: r.URL.Query().Get("resourceId"),
		Action:     r.URL.Query().Get("action"),
		Cluster:    r.URL.Query().Get("cluster"),
	}

	events, err := h.store.ListAuditEvents(ctx, filter)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if events == nil {
		events = []store.AuditEvent{}
	}
	writeJSON(w, http.StatusOK, events)
}
