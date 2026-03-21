package discovery

import (
	"context"
	"fmt"
	"strings"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

// DiscoveredWorkload represents a workload found in a Kubernetes cluster.
type DiscoveredWorkload struct {
	Cluster       string            `json:"cluster"`
	Namespace     string            `json:"namespace"`
	Name          string            `json:"name"`
	Kind          string            `json:"kind"`
	Replicas      int32             `json:"replicas"`
	Labels        map[string]string `json:"labels"`
	Containers    []ContainerInfo   `json:"containers"`
	MatchingFlags []string          `json:"matchingFlags,omitempty"`
}

// ContainerInfo contains details about a container in a workload.
type ContainerInfo struct {
	Name          string         `json:"name"`
	Image         string         `json:"image"`
	EnvVars       []EnvVarInfo   `json:"envVars"`
	ConfigMapRefs []ConfigMapRef `json:"configMapRefs"`
	SecretRefs    []SecretRef    `json:"secretRefs"`
}

// EnvVarInfo describes an environment variable.
type EnvVarInfo struct {
	Name     string `json:"name"`
	Value    string `json:"value,omitempty"`
	Source   string `json:"source,omitempty"`
	IsMasked bool   `json:"isMasked"`
	IsFlag   bool   `json:"isFlag"`
	FlagName string `json:"flagName,omitempty"`
}

// ConfigMapRef references a ConfigMap used by a workload.
type ConfigMapRef struct {
	Name string `json:"name"`
	Key  string `json:"key,omitempty"`
}

// SecretRef references a Secret used by a workload.
type SecretRef struct {
	Name string `json:"name"`
	Key  string `json:"key,omitempty"`
}

// Scanner discovers workloads in a Kubernetes cluster.
type Scanner struct {
	client    client.Client
	clusterID string
	// vexilManagedCMs holds ConfigMap names managed by Vexil (label app.kubernetes.io/managed-by=vexil)
	vexilManagedCMs map[string]bool
}

// NewScanner creates a new workload scanner.
func NewScanner(c client.Client, clusterID string) *Scanner {
	return &Scanner{
		client:          c,
		clusterID:       clusterID,
		vexilManagedCMs: make(map[string]bool),
	}
}

// ScanNamespace discovers all workloads in a namespace.
// Only Vexil-related configuration (FLAG_* env vars, Vexil-managed ConfigMaps) is exposed.
func (s *Scanner) ScanNamespace(ctx context.Context, namespace string) ([]DiscoveredWorkload, error) {
	// Pre-fetch Vexil-managed ConfigMaps in this namespace
	if err := s.loadVexilConfigMaps(ctx, namespace); err != nil {
		// Non-fatal: just means we won't identify Vexil ConfigMap refs
		s.vexilManagedCMs = make(map[string]bool)
	}

	var workloads []DiscoveredWorkload

	// Scan Deployments
	var deployments appsv1.DeploymentList
	if err := s.client.List(ctx, &deployments, client.InNamespace(namespace)); err != nil {
		return nil, fmt.Errorf("listing deployments: %w", err)
	}
	for _, d := range deployments.Items {
		var replicas int32
		if d.Spec.Replicas != nil {
			replicas = *d.Spec.Replicas
		}
		workloads = append(workloads, DiscoveredWorkload{
			Cluster:    s.clusterID,
			Namespace:  d.Namespace,
			Name:       d.Name,
			Kind:       "Deployment",
			Replicas:   replicas,
			Labels:     d.Labels,
			Containers: s.extractContainersSafe(d.Spec.Template.Spec.Containers),
		})
	}

	// Scan StatefulSets
	var statefulsets appsv1.StatefulSetList
	if err := s.client.List(ctx, &statefulsets, client.InNamespace(namespace)); err != nil {
		return nil, fmt.Errorf("listing statefulsets: %w", err)
	}
	for _, ss := range statefulsets.Items {
		var replicas int32
		if ss.Spec.Replicas != nil {
			replicas = *ss.Spec.Replicas
		}
		workloads = append(workloads, DiscoveredWorkload{
			Cluster:    s.clusterID,
			Namespace:  ss.Namespace,
			Name:       ss.Name,
			Kind:       "StatefulSet",
			Replicas:   replicas,
			Labels:     ss.Labels,
			Containers: s.extractContainersSafe(ss.Spec.Template.Spec.Containers),
		})
	}

	// Scan DaemonSets
	var daemonsets appsv1.DaemonSetList
	if err := s.client.List(ctx, &daemonsets, client.InNamespace(namespace)); err != nil {
		return nil, fmt.Errorf("listing daemonsets: %w", err)
	}
	for _, ds := range daemonsets.Items {
		workloads = append(workloads, DiscoveredWorkload{
			Cluster:    s.clusterID,
			Namespace:  ds.Namespace,
			Name:       ds.Name,
			Kind:       "DaemonSet",
			Replicas:   ds.Status.DesiredNumberScheduled,
			Labels:     ds.Labels,
			Containers: s.extractContainersSafe(ds.Spec.Template.Spec.Containers),
		})
	}

	return workloads, nil
}

// systemNamespaces are namespaces to skip during cluster-wide scans.
var systemNamespaces = map[string]bool{
	"kube-system":       true,
	"kube-public":       true,
	"kube-node-lease":   true,
	"local-path-storage": true,
}

// ScanCluster discovers workloads only in namespaces that have FeatureFlags.
// If allowedNamespaces is non-empty, only those namespaces are scanned.
// System namespaces are always excluded.
func (s *Scanner) ScanCluster(ctx context.Context, allowedNamespaces []string) ([]DiscoveredWorkload, error) {
	if len(allowedNamespaces) == 0 {
		return []DiscoveredWorkload{}, nil
	}

	var allWorkloads []DiscoveredWorkload
	for _, ns := range allowedNamespaces {
		if systemNamespaces[ns] {
			continue
		}
		workloads, err := s.ScanNamespace(ctx, ns)
		if err != nil {
			continue
		}
		allWorkloads = append(allWorkloads, workloads...)
	}

	return allWorkloads, nil
}

// loadVexilConfigMaps fetches ConfigMaps managed by Vexil in a namespace.
func (s *Scanner) loadVexilConfigMaps(ctx context.Context, namespace string) error {
	var cmList corev1.ConfigMapList
	if err := s.client.List(ctx, &cmList,
		client.InNamespace(namespace),
		client.MatchingLabels{"app.kubernetes.io/managed-by": "vexil"},
	); err != nil {
		return err
	}
	for _, cm := range cmList.Items {
		s.vexilManagedCMs[cm.Name] = true
	}
	return nil
}

// extractContainersSafe extracts only Vexil-related config from containers.
// - Only FLAG_* env vars are included
// - Only Vexil-managed ConfigMap refs are included
// - Secret names/keys are never exposed
func (s *Scanner) extractContainersSafe(containers []corev1.Container) []ContainerInfo {
	var infos []ContainerInfo

	for _, c := range containers {
		info := ContainerInfo{
			Name:  c.Name,
			Image: c.Image,
		}

		// Only expose FLAG_* env vars
		for _, env := range c.Env {
			if !strings.HasPrefix(env.Name, "FLAG_") {
				continue
			}

			ev := EnvVarInfo{
				Name:   env.Name,
				IsFlag: true,
				FlagName: env.Name[5:],
			}

			if env.ValueFrom != nil {
				if env.ValueFrom.ConfigMapKeyRef != nil {
					ev.Source = fmt.Sprintf("configmap:%s/%s", env.ValueFrom.ConfigMapKeyRef.Name, env.ValueFrom.ConfigMapKeyRef.Key)
					info.ConfigMapRefs = append(info.ConfigMapRefs, ConfigMapRef{
						Name: env.ValueFrom.ConfigMapKeyRef.Name,
						Key:  env.ValueFrom.ConfigMapKeyRef.Key,
					})
				} else if env.ValueFrom.SecretKeyRef != nil {
					ev.Source = "secret"
					ev.IsMasked = true
				}
			} else {
				ev.Value = env.Value
			}

			info.EnvVars = append(info.EnvVars, ev)
		}

		// Only expose Vexil-managed ConfigMap refs from envFrom
		for _, envFrom := range c.EnvFrom {
			if envFrom.ConfigMapRef != nil && s.vexilManagedCMs[envFrom.ConfigMapRef.Name] {
				info.ConfigMapRefs = append(info.ConfigMapRefs, ConfigMapRef{
					Name: envFrom.ConfigMapRef.Name,
				})
			}
			// Secrets from envFrom are never exposed
		}

		infos = append(infos, info)
	}

	return infos
}
