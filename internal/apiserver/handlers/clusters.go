package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/vexil-platform/vexil/internal/apiserver/store"
	"github.com/vexil-platform/vexil/internal/multicluster"
)

// ClusterHandler handles cluster management API requests.
type ClusterHandler struct {
	clusters *multicluster.Manager
	store    store.Store
}

// NewClusterHandler creates a new ClusterHandler.
func NewClusterHandler(clusters *multicluster.Manager, st store.Store) *ClusterHandler {
	return &ClusterHandler{clusters: clusters, store: st}
}

// RegisterClusterRequest is the request body for registering a cluster.
type RegisterClusterRequest struct {
	ID          string `json:"id"`
	DisplayName string `json:"displayName"`
	APIServer   string `json:"apiServer"`
	Kubeconfig  string `json:"kubeconfig,omitempty"`
	Token       string `json:"token,omitempty"`
}

// ClusterResponse is the API response for a cluster.
type ClusterResponse struct {
	ID                  string `json:"id"`
	DisplayName         string `json:"displayName"`
	APIServer           string `json:"apiServer"`
	Status              string `json:"status"`
	KubernetesVersion   string `json:"kubernetesVersion,omitempty"`
	DiscoveredWorkloads int    `json:"discoveredWorkloads"`
}

// List returns all registered clusters.
func (h *ClusterHandler) List(w http.ResponseWriter, r *http.Request) {
	clusters := h.clusters.ListClusters()
	var resp []ClusterResponse
	for _, c := range clusters {
		resp = append(resp, ClusterResponse{
			ID:                  c.ID,
			DisplayName:         c.DisplayName,
			APIServer:           c.APIServer,
			Status:              string(c.Status),
			KubernetesVersion:   c.KubernetesVersion,
			DiscoveredWorkloads: c.DiscoveredWorkloads,
		})
	}
	if resp == nil {
		resp = []ClusterResponse{}
	}
	writeJSON(w, http.StatusOK, resp)
}

// Register adds a new cluster connection.
func (h *ClusterHandler) Register(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req RegisterClusterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.ID == "" || req.DisplayName == "" {
		writeError(w, http.StatusBadRequest, "id and displayName are required")
		return
	}

	clusterInfo := multicluster.ClusterInfo{
		ID:          req.ID,
		DisplayName: req.DisplayName,
		APIServer:   req.APIServer,
	}

	if err := h.clusters.AddCluster(ctx, clusterInfo, req.Kubeconfig, req.Token); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.store.RecordAudit(ctx, store.AuditEvent{
		Action:     "register",
		Resource:   "cluster",
		ResourceID: req.ID,
	})

	writeJSON(w, http.StatusCreated, ClusterResponse{
		ID:          req.ID,
		DisplayName: req.DisplayName,
		APIServer:   req.APIServer,
		Status:      "Connected",
	})
}

// Get returns details for a specific cluster.
func (h *ClusterHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	info, err := h.clusters.GetClusterInfo(id)
	if err != nil {
		writeError(w, http.StatusNotFound, "cluster not found")
		return
	}

	writeJSON(w, http.StatusOK, ClusterResponse{
		ID:                  info.ID,
		DisplayName:         info.DisplayName,
		APIServer:           info.APIServer,
		Status:              string(info.Status),
		KubernetesVersion:   info.KubernetesVersion,
		DiscoveredWorkloads: info.DiscoveredWorkloads,
	})
}

// Remove unregisters a cluster.
func (h *ClusterHandler) Remove(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := r.PathValue("id")

	if err := h.clusters.RemoveCluster(ctx, id); err != nil {
		writeError(w, http.StatusNotFound, "cluster not found")
		return
	}

	h.store.RecordAudit(ctx, store.AuditEvent{
		Action:     "remove",
		Resource:   "cluster",
		ResourceID: id,
	})

	w.WriteHeader(http.StatusNoContent)
}
