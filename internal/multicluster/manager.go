package multicluster

import (
	"context"
	"fmt"
	"sync"

	"k8s.io/apimachinery/pkg/runtime"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	clientgoscheme "k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"sigs.k8s.io/controller-runtime/pkg/client"

	vexilv1alpha1 "github.com/vexil-platform/vexil/pkg/apis/v1alpha1"
)

var scheme = runtime.NewScheme()

func init() {
	utilruntime.Must(clientgoscheme.AddToScheme(scheme))
	utilruntime.Must(vexilv1alpha1.AddToScheme(scheme))
}

// ConnectionStatus represents the health state of a cluster connection.
type ConnectionStatus string

const (
	StatusConnected    ConnectionStatus = "Connected"
	StatusDisconnected ConnectionStatus = "Disconnected"
	StatusError        ConnectionStatus = "Error"
)

// ClusterInfo holds metadata about a connected cluster.
type ClusterInfo struct {
	ID                  string           `json:"id"`
	DisplayName         string           `json:"displayName"`
	APIServer           string           `json:"apiServer"`
	Status              ConnectionStatus `json:"status"`
	KubernetesVersion   string           `json:"kubernetesVersion,omitempty"`
	DiscoveredWorkloads int              `json:"discoveredWorkloads"`
}

// clusterConn holds the runtime connection for a cluster.
type clusterConn struct {
	info   ClusterInfo
	config *rest.Config
	client client.Client
}

// Manager manages connections to multiple Kubernetes clusters.
type Manager struct {
	mu       sync.RWMutex
	clusters map[string]*clusterConn
}

// NewManager creates a new multicluster manager.
func NewManager() *Manager {
	return &Manager{
		clusters: make(map[string]*clusterConn),
	}
}

// AddCluster registers a new cluster connection.
func (m *Manager) AddCluster(ctx context.Context, info ClusterInfo, kubeconfig string, token string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.clusters[info.ID]; exists {
		return fmt.Errorf("cluster %s already registered", info.ID)
	}

	var cfg *rest.Config
	var err error

	if kubeconfig != "" {
		cfg, err = clientcmd.RESTConfigFromKubeConfig([]byte(kubeconfig))
		if err != nil {
			return fmt.Errorf("parsing kubeconfig: %w", err)
		}
	} else if token != "" {
		cfg = &rest.Config{
			Host:            info.APIServer,
			BearerToken:     token,
			TLSClientConfig: rest.TLSClientConfig{Insecure: false},
		}
	} else {
		return fmt.Errorf("either kubeconfig or token must be provided")
	}

	k8sClient, err := client.New(cfg, client.Options{Scheme: scheme})
	if err != nil {
		return fmt.Errorf("creating k8s client: %w", err)
	}

	// Test connectivity
	info.Status = StatusConnected

	m.clusters[info.ID] = &clusterConn{
		info:   info,
		config: cfg,
		client: k8sClient,
	}

	return nil
}

// AddClusterFromConfig registers a cluster from a rest.Config (for local/in-cluster usage).
func (m *Manager) AddClusterFromConfig(info ClusterInfo, cfg *rest.Config) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	k8sClient, err := client.New(cfg, client.Options{Scheme: scheme})
	if err != nil {
		return fmt.Errorf("creating k8s client: %w", err)
	}

	info.Status = StatusConnected

	m.clusters[info.ID] = &clusterConn{
		info:   info,
		config: cfg,
		client: k8sClient,
	}

	return nil
}

// RemoveCluster unregisters a cluster.
func (m *Manager) RemoveCluster(_ context.Context, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.clusters[id]; !exists {
		return fmt.Errorf("cluster %s not found", id)
	}

	delete(m.clusters, id)
	return nil
}

// GetClient returns the controller-runtime client for a cluster.
func (m *Manager) GetClient(clusterID string) (client.Client, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	conn, exists := m.clusters[clusterID]
	if !exists {
		return nil, fmt.Errorf("cluster %s not found", clusterID)
	}

	return conn.client, nil
}

// GetClusterInfo returns metadata for a cluster.
func (m *Manager) GetClusterInfo(clusterID string) (ClusterInfo, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	conn, exists := m.clusters[clusterID]
	if !exists {
		return ClusterInfo{}, fmt.Errorf("cluster %s not found", clusterID)
	}

	return conn.info, nil
}

// ClusterIDs returns all registered cluster IDs.
func (m *Manager) ClusterIDs() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	ids := make([]string, 0, len(m.clusters))
	for id := range m.clusters {
		ids = append(ids, id)
	}
	return ids
}

// ListClusters returns info for all registered clusters.
func (m *Manager) ListClusters() []ClusterInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()

	clusters := make([]ClusterInfo, 0, len(m.clusters))
	for _, conn := range m.clusters {
		clusters = append(clusters, conn.info)
	}
	return clusters
}
