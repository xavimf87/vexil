package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	vexilv1alpha1 "github.com/vexil-platform/vexil/pkg/apis/v1alpha1"
	"github.com/vexil-platform/vexil/internal/apiserver/store"
	"github.com/vexil-platform/vexil/internal/multicluster"
)

// FlagHandler handles feature flag API requests.
type FlagHandler struct {
	clusters *multicluster.Manager
	store    store.Store
}

// NewFlagHandler creates a new FlagHandler.
func NewFlagHandler(clusters *multicluster.Manager, st store.Store) *FlagHandler {
	return &FlagHandler{clusters: clusters, store: st}
}

// CreateFlagRequest is the request body for creating a flag.
type CreateFlagRequest struct {
	Name         string                         `json:"name"`
	Namespace    string                         `json:"namespace"`
	ClusterID    string                         `json:"clusterId"`
	Description  string                         `json:"description,omitempty"`
	Type         vexilv1alpha1.FlagType          `json:"type"`
	DefaultValue string                         `json:"defaultValue"`
	Delivery     *vexilv1alpha1.DeliverySpec     `json:"delivery,omitempty"`
}

// FlagResponse is the API response for a feature flag.
type FlagResponse struct {
	Name              string                         `json:"name"`
	Namespace         string                         `json:"namespace"`
	ClusterID         string                         `json:"clusterId"`
	Description       string                         `json:"description,omitempty"`
	Type              vexilv1alpha1.FlagType          `json:"type"`
	DefaultValue      string                         `json:"defaultValue"`
	CurrentValue      string                         `json:"currentValue"`
	Phase             vexilv1alpha1.FlagPhase         `json:"phase"`
	Disabled          bool                           `json:"disabled"`
	TargetedWorkloads int32                          `json:"targetedWorkloads"`
	Lifecycle         vexilv1alpha1.FlagLifecycle     `json:"lifecycle"`
	Delivery          *vexilv1alpha1.DeliverySpec     `json:"delivery,omitempty"`
	Rules             []vexilv1alpha1.TargetingRule   `json:"rules,omitempty"`
	CreatedAt         time.Time                      `json:"createdAt"`
	UpdatedAt         *time.Time                     `json:"updatedAt,omitempty"`
}

// List returns all feature flags across clusters.
func (h *FlagHandler) List(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	clusterID := r.URL.Query().Get("clusterId")
	namespace := r.URL.Query().Get("namespace")

	var allFlags []FlagResponse

	clusterIDs := h.clusters.ClusterIDs()
	for _, cid := range clusterIDs {
		if clusterID != "" && cid != clusterID {
			continue
		}

		k8sClient, err := h.clusters.GetClient(cid)
		if err != nil {
			continue
		}

		var flagList vexilv1alpha1.FeatureFlagList
		if err := k8sClient.List(ctx, &flagList); err != nil {
			continue
		}

		for _, f := range flagList.Items {
			if namespace != "" && f.Namespace != namespace {
				continue
			}
			allFlags = append(allFlags, flagToResponse(f, cid))
		}
	}

	writeJSON(w, http.StatusOK, allFlags)
}

// Create creates a new feature flag.
func (h *FlagHandler) Create(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req CreateFlagRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name == "" || req.Namespace == "" || req.ClusterID == "" {
		writeError(w, http.StatusBadRequest, "name, namespace, and clusterId are required")
		return
	}

	k8sClient, err := h.clusters.GetClient(req.ClusterID)
	if err != nil {
		writeError(w, http.StatusNotFound, fmt.Sprintf("cluster not found: %s", req.ClusterID))
		return
	}

	flag := &vexilv1alpha1.FeatureFlag{
		ObjectMeta: metav1.ObjectMeta{
			Name:      req.Name,
			Namespace: req.Namespace,
		},
		Spec: vexilv1alpha1.FeatureFlagSpec{
			Description:  req.Description,
			Type:         req.Type,
			DefaultValue: req.DefaultValue,
			Delivery:     req.Delivery,
			Lifecycle:    vexilv1alpha1.FlagLifecycleActive,
		},
	}

	if err := k8sClient.Create(ctx, flag); err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to create flag: %v", err))
		return
	}

	// Audit log
	h.store.RecordAudit(ctx, store.AuditEvent{
		Action:     "create",
		Resource:   "featureflag",
		ResourceID: fmt.Sprintf("%s/%s", req.Namespace, req.Name),
		Cluster:    req.ClusterID,
	})

	writeJSON(w, http.StatusCreated, flagToResponse(*flag, req.ClusterID))
}

// Get returns a specific feature flag.
func (h *FlagHandler) Get(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	namespace := r.PathValue("namespace")
	name := r.PathValue("name")
	clusterID := r.URL.Query().Get("clusterId")

	if clusterID == "" {
		writeError(w, http.StatusBadRequest, "clusterId query parameter is required")
		return
	}

	k8sClient, err := h.clusters.GetClient(clusterID)
	if err != nil {
		writeError(w, http.StatusNotFound, "cluster not found")
		return
	}

	var flag vexilv1alpha1.FeatureFlag
	if err := k8sClient.Get(ctx, types.NamespacedName{Namespace: namespace, Name: name}, &flag); err != nil {
		writeError(w, http.StatusNotFound, "flag not found")
		return
	}

	writeJSON(w, http.StatusOK, flagToResponse(flag, clusterID))
}

// Update updates a feature flag.
func (h *FlagHandler) Update(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	namespace := r.PathValue("namespace")
	name := r.PathValue("name")
	clusterID := r.URL.Query().Get("clusterId")

	if clusterID == "" {
		writeError(w, http.StatusBadRequest, "clusterId query parameter is required")
		return
	}

	k8sClient, err := h.clusters.GetClient(clusterID)
	if err != nil {
		writeError(w, http.StatusNotFound, "cluster not found")
		return
	}

	var flag vexilv1alpha1.FeatureFlag
	if err := k8sClient.Get(ctx, types.NamespacedName{Namespace: namespace, Name: name}, &flag); err != nil {
		writeError(w, http.StatusNotFound, "flag not found")
		return
	}

	var updates struct {
		Description  *string                        `json:"description,omitempty"`
		DefaultValue *string                        `json:"defaultValue,omitempty"`
		Disabled     *bool                          `json:"disabled,omitempty"`
		Delivery     *vexilv1alpha1.DeliverySpec     `json:"delivery,omitempty"`
		Rules        []vexilv1alpha1.TargetingRule   `json:"rules,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if updates.Description != nil {
		flag.Spec.Description = *updates.Description
	}
	if updates.DefaultValue != nil {
		flag.Spec.DefaultValue = *updates.DefaultValue
	}
	if updates.Disabled != nil {
		flag.Spec.Disabled = *updates.Disabled
	}
	if updates.Delivery != nil {
		flag.Spec.Delivery = updates.Delivery
	}
	if updates.Rules != nil {
		flag.Spec.Rules = updates.Rules
	}

	if err := k8sClient.Update(ctx, &flag); err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to update flag: %v", err))
		return
	}

	h.store.RecordAudit(ctx, store.AuditEvent{
		Action:     "update",
		Resource:   "featureflag",
		ResourceID: fmt.Sprintf("%s/%s", namespace, name),
		Cluster:    clusterID,
	})

	writeJSON(w, http.StatusOK, flagToResponse(flag, clusterID))
}

// Delete removes a feature flag.
func (h *FlagHandler) Delete(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	namespace := r.PathValue("namespace")
	name := r.PathValue("name")
	clusterID := r.URL.Query().Get("clusterId")

	if clusterID == "" {
		writeError(w, http.StatusBadRequest, "clusterId query parameter is required")
		return
	}

	k8sClient, err := h.clusters.GetClient(clusterID)
	if err != nil {
		writeError(w, http.StatusNotFound, "cluster not found")
		return
	}

	var flag vexilv1alpha1.FeatureFlag
	if err := k8sClient.Get(ctx, types.NamespacedName{Namespace: namespace, Name: name}, &flag); err != nil {
		writeError(w, http.StatusNotFound, "flag not found")
		return
	}

	if err := k8sClient.Delete(ctx, &flag); err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to delete flag: %v", err))
		return
	}

	h.store.RecordAudit(ctx, store.AuditEvent{
		Action:     "delete",
		Resource:   "featureflag",
		ResourceID: fmt.Sprintf("%s/%s", namespace, name),
		Cluster:    clusterID,
	})

	w.WriteHeader(http.StatusNoContent)
}

// Toggle toggles a boolean feature flag.
func (h *FlagHandler) Toggle(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	namespace := r.PathValue("namespace")
	name := r.PathValue("name")
	clusterID := r.URL.Query().Get("clusterId")

	if clusterID == "" {
		writeError(w, http.StatusBadRequest, "clusterId query parameter is required")
		return
	}

	k8sClient, err := h.clusters.GetClient(clusterID)
	if err != nil {
		writeError(w, http.StatusNotFound, "cluster not found")
		return
	}

	var flag vexilv1alpha1.FeatureFlag
	if err := k8sClient.Get(ctx, types.NamespacedName{Namespace: namespace, Name: name}, &flag); err != nil {
		writeError(w, http.StatusNotFound, "flag not found")
		return
	}

	if flag.Spec.Type != vexilv1alpha1.FlagTypeBoolean {
		writeError(w, http.StatusBadRequest, "toggle is only supported for boolean flags")
		return
	}

	// Toggle the value
	if flag.Spec.DefaultValue == "true" {
		flag.Spec.DefaultValue = "false"
	} else {
		flag.Spec.DefaultValue = "true"
	}

	if err := k8sClient.Update(ctx, &flag); err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to toggle flag: %v", err))
		return
	}

	h.store.RecordAudit(ctx, store.AuditEvent{
		Action:     "toggle",
		Resource:   "featureflag",
		ResourceID: fmt.Sprintf("%s/%s", namespace, name),
		Cluster:    clusterID,
	})

	writeJSON(w, http.StatusOK, flagToResponse(flag, clusterID))
}

func flagToResponse(f vexilv1alpha1.FeatureFlag, clusterID string) FlagResponse {
	resp := FlagResponse{
		Name:              f.Name,
		Namespace:         f.Namespace,
		ClusterID:         clusterID,
		Description:       f.Spec.Description,
		Type:              f.Spec.Type,
		DefaultValue:      f.Spec.DefaultValue,
		CurrentValue:      f.Status.CurrentValue,
		Phase:             f.Status.Phase,
		Disabled:          f.Spec.Disabled,
		TargetedWorkloads: f.Status.TargetedWorkloads,
		Lifecycle:         f.Spec.Lifecycle,
		Delivery:          f.Spec.Delivery,
		Rules:             f.Spec.Rules,
		CreatedAt:         f.CreationTimestamp.Time,
	}
	if f.Status.LastUpdated != nil {
		t := f.Status.LastUpdated.Time
		resp.UpdatedAt = &t
	}
	return resp
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
