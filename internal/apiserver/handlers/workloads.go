package handlers

import (
	"context"
	"net/http"
	"sort"
	"time"

	corev1 "k8s.io/api/core/v1"

	"github.com/vexil-platform/vexil/internal/discovery"
	"github.com/vexil-platform/vexil/internal/multicluster"
)

// WorkloadHandler handles workload discovery API requests.
type WorkloadHandler struct {
	clusters *multicluster.Manager
}

// NewWorkloadHandler creates a new WorkloadHandler.
func NewWorkloadHandler(clusters *multicluster.Manager) *WorkloadHandler {
	return &WorkloadHandler{clusters: clusters}
}

// ListNamespaces returns user namespaces for a cluster.
func (h *WorkloadHandler) ListNamespaces(w http.ResponseWriter, r *http.Request) {
	clusterID := r.PathValue("id")

	k8sClient, err := h.clusters.GetClient(clusterID)
	if err != nil {
		writeError(w, http.StatusNotFound, "cluster not found")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var nsList corev1.NamespaceList
	if err := k8sClient.List(ctx, &nsList); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	systemNs := map[string]bool{
		"kube-system": true, "kube-public": true,
		"kube-node-lease": true, "local-path-storage": true,
	}

	var names []string
	for _, ns := range nsList.Items {
		if !systemNs[ns.Name] {
			names = append(names, ns.Name)
		}
	}
	sort.Strings(names)

	if names == nil {
		names = []string{}
	}
	writeJSON(w, http.StatusOK, names)
}

// List returns all discovered workloads for a cluster.
func (h *WorkloadHandler) List(w http.ResponseWriter, r *http.Request) {
	clusterID := r.PathValue("id")
	namespace := r.URL.Query().Get("namespace")

	k8sClient, err := h.clusters.GetClient(clusterID)
	if err != nil {
		writeError(w, http.StatusNotFound, "cluster not found")
		return
	}

	// Timeout to prevent hanging on large clusters
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	scanner := discovery.NewScanner(k8sClient, clusterID)

	var workloads []discovery.DiscoveredWorkload
	if namespace != "" {
		workloads, err = scanner.ScanNamespace(ctx, namespace)
	} else {
		workloads, err = scanner.ScanCluster(ctx)
	}

	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if workloads == nil {
		workloads = []discovery.DiscoveredWorkload{}
	}
	writeJSON(w, http.StatusOK, workloads)
}

// Get returns details for a specific workload.
func (h *WorkloadHandler) Get(w http.ResponseWriter, r *http.Request) {
	clusterID := r.PathValue("id")
	namespace := r.PathValue("namespace")
	name := r.PathValue("name")

	k8sClient, err := h.clusters.GetClient(clusterID)
	if err != nil {
		writeError(w, http.StatusNotFound, "cluster not found")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	scanner := discovery.NewScanner(k8sClient, clusterID)
	workloads, err := scanner.ScanNamespace(ctx, namespace)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	for _, wl := range workloads {
		if wl.Name == name {
			writeJSON(w, http.StatusOK, wl)
			return
		}
	}

	writeError(w, http.StatusNotFound, "workload not found")
}
