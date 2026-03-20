package v1alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// ClusterAuthMethod defines how to authenticate to a remote cluster.
type ClusterAuthMethod string

const (
	AuthKubeconfig     ClusterAuthMethod = "kubeconfig"
	AuthServiceAccount ClusterAuthMethod = "serviceaccount"
	AuthOIDC           ClusterAuthMethod = "oidc"
)

// ConnectionPhase describes the connection state of a cluster.
type ConnectionPhase string

const (
	ConnectionConnected    ConnectionPhase = "Connected"
	ConnectionDisconnected ConnectionPhase = "Disconnected"
	ConnectionError        ConnectionPhase = "Error"
)

// ClusterConnectionSpec defines how to connect to a remote Kubernetes cluster.
type ClusterConnectionSpec struct {
	// DisplayName is a human-friendly name for this cluster.
	DisplayName string `json:"displayName"`

	// AuthMethod defines how to authenticate.
	// +kubebuilder:validation:Enum=kubeconfig;serviceaccount;oidc
	AuthMethod ClusterAuthMethod `json:"authMethod"`

	// APIServer is the URL of the Kubernetes API server.
	APIServer string `json:"apiServer"`

	// CredentialRef references a Secret containing auth credentials.
	CredentialRef SecretKeyRef `json:"credentialRef"`

	// Namespaces to watch. Empty means all accessible namespaces.
	// +optional
	Namespaces []string `json:"namespaces,omitempty"`

	// ResyncPeriod defines how often to resync discovered workloads.
	// +kubebuilder:default="30s"
	// +optional
	ResyncPeriod metav1.Duration `json:"resyncPeriod,omitempty"`

	// Labels to assign to this cluster for targeting rules.
	// +optional
	Labels map[string]string `json:"labels,omitempty"`
}

// SecretKeyRef references a key within a Secret.
type SecretKeyRef struct {
	// Name is the name of the Secret.
	Name string `json:"name"`
	// Key is the key within the Secret.
	Key string `json:"key"`
}

// ClusterConnectionStatus defines the observed state of a ClusterConnection.
type ClusterConnectionStatus struct {
	// Phase is the current connection state.
	Phase ConnectionPhase `json:"phase,omitempty"`

	// KubernetesVersion is the version of the connected cluster.
	KubernetesVersion string `json:"kubernetesVersion,omitempty"`

	// LastProbe is the last time connectivity was verified.
	// +optional
	LastProbe *metav1.Time `json:"lastProbe,omitempty"`

	// DiscoveredWorkloads is the number of workloads found.
	DiscoveredWorkloads int32 `json:"discoveredWorkloads,omitempty"`

	// Conditions represent the latest available observations.
	// +optional
	Conditions []metav1.Condition `json:"conditions,omitempty"`
}

// +kubebuilder:object:root=true
// +kubebuilder:subresource:status
// +kubebuilder:printcolumn:name="Display Name",type=string,JSONPath=`.spec.displayName`
// +kubebuilder:printcolumn:name="Phase",type=string,JSONPath=`.status.phase`
// +kubebuilder:printcolumn:name="Version",type=string,JSONPath=`.status.kubernetesVersion`
// +kubebuilder:printcolumn:name="Workloads",type=integer,JSONPath=`.status.discoveredWorkloads`
// +kubebuilder:printcolumn:name="Age",type=date,JSONPath=`.metadata.creationTimestamp`

// ClusterConnection is the Schema for connecting to remote Kubernetes clusters.
type ClusterConnection struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   ClusterConnectionSpec   `json:"spec,omitempty"`
	Status ClusterConnectionStatus `json:"status,omitempty"`
}

// +kubebuilder:object:root=true

// ClusterConnectionList contains a list of ClusterConnection.
type ClusterConnectionList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []ClusterConnection `json:"items"`
}

func init() {
	SchemeBuilder.Register(&ClusterConnection{}, &ClusterConnectionList{})
}
