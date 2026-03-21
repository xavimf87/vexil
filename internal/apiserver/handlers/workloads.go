package handlers

import (
	"context"
	"net/http"
	"sort"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"sigs.k8s.io/controller-runtime/pkg/client"

	vexilv1alpha1 "github.com/vexil-platform/vexil/pkg/apis/v1alpha1"
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

// ListNamespaces returns namespaces that have FeatureFlags deployed.
func (h *WorkloadHandler) ListNamespaces(w http.ResponseWriter, r *http.Request) {
	clusterID := r.PathValue("id")

	k8sClient, err := h.clusters.GetClient(clusterID)
	if err != nil {
		writeError(w, http.StatusNotFound, "cluster not found")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	names, err := namespacesWithFlags(ctx, k8sClient)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, names)
}

// List returns discovered workloads, restricted to namespaces with FeatureFlags.
func (h *WorkloadHandler) List(w http.ResponseWriter, r *http.Request) {
	clusterID := r.PathValue("id")
	namespace := r.URL.Query().Get("namespace")

	k8sClient, err := h.clusters.GetClient(clusterID)
	if err != nil {
		writeError(w, http.StatusNotFound, "cluster not found")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	scanner := discovery.NewScanner(k8sClient, clusterID)

	var workloads []discovery.DiscoveredWorkload
	if namespace != "" {
		// Verify the namespace has flags before scanning
		allowed, _ := namespacesWithFlags(ctx, k8sClient)
		if !contains(allowed, namespace) {
			writeJSON(w, http.StatusOK, []discovery.DiscoveredWorkload{})
			return
		}
		workloads, err = scanner.ScanNamespace(ctx, namespace)
	} else {
		allowed, _ := namespacesWithFlags(ctx, k8sClient)
		workloads, err = scanner.ScanCluster(ctx, allowed)
	}

	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if workloads == nil {
		workloads = []discovery.DiscoveredWorkload{}
	}

	// Enrich workloads with matching flags
	enrichWithMatchingFlags(ctx, k8sClient, workloads)

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

	// Verify namespace has flags
	allowed, _ := namespacesWithFlags(ctx, k8sClient)
	if !contains(allowed, namespace) {
		writeError(w, http.StatusNotFound, "workload not found")
		return
	}

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

// namespacesWithFlags returns sorted namespaces that contain at least one FeatureFlag.
func namespacesWithFlags(ctx context.Context, k8sClient client.Client) ([]string, error) {
	var flagList vexilv1alpha1.FeatureFlagList
	if err := k8sClient.List(ctx, &flagList); err != nil {
		return nil, err
	}

	nsSet := make(map[string]bool)
	for _, f := range flagList.Items {
		nsSet[f.Namespace] = true
	}

	if len(nsSet) == 0 {
		return []string{}, nil
	}

	names := make([]string, 0, len(nsSet))
	for ns := range nsSet {
		names = append(names, ns)
	}
	sort.Strings(names)
	return names, nil
}

func contains(ss []string, s string) bool {
	for _, v := range ss {
		if v == s {
			return true
		}
	}
	return false
}

// enrichWithMatchingFlags adds the list of FeatureFlag names that target each workload
// based on the flag's delivery label selector.
func enrichWithMatchingFlags(ctx context.Context, k8sClient client.Client, workloads []discovery.DiscoveredWorkload) {
	// Collect unique namespaces
	nsSet := make(map[string]bool)
	for _, wl := range workloads {
		nsSet[wl.Namespace] = true
	}

	// Fetch flags per namespace and build selector cache
	type flagSelector struct {
		name     string
		ns       string
		selector labels.Selector
	}
	var selectors []flagSelector

	for ns := range nsSet {
		var flagList vexilv1alpha1.FeatureFlagList
		if err := k8sClient.List(ctx, &flagList, client.InNamespace(ns)); err != nil {
			continue
		}
		for _, f := range flagList.Items {
			if f.Spec.Delivery == nil {
				continue
			}
			var ls *metav1.LabelSelector
			if f.Spec.Delivery.EnvVar != nil {
				ls = f.Spec.Delivery.EnvVar.Selector
			} else if f.Spec.Delivery.ConfigMap != nil {
				ls = f.Spec.Delivery.ConfigMap.Selector
			} else if f.Spec.Delivery.Sidecar != nil {
				ls = f.Spec.Delivery.Sidecar.Selector
			}
			if ls == nil {
				continue
			}
			sel, err := metav1.LabelSelectorAsSelector(ls)
			if err != nil {
				continue
			}
			selectors = append(selectors, flagSelector{name: f.Name, ns: f.Namespace, selector: sel})
		}
	}

	// Match each workload against all flag selectors in its namespace
	for i := range workloads {
		wl := &workloads[i]
		wlLabels := labels.Set(wl.Labels)
		for _, fs := range selectors {
			if fs.ns == wl.Namespace && fs.selector.Matches(wlLabels) {
				wl.MatchingFlags = append(wl.MatchingFlags, fs.name)
			}
		}
	}
}
