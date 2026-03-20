package discovery

import (
	"context"
	"fmt"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

// DiscoveredWorkload represents a workload found in a Kubernetes cluster.
type DiscoveredWorkload struct {
	Cluster    string            `json:"cluster"`
	Namespace  string            `json:"namespace"`
	Name       string            `json:"name"`
	Kind       string            `json:"kind"`
	Replicas   int32             `json:"replicas"`
	Labels     map[string]string `json:"labels"`
	Containers []ContainerInfo   `json:"containers"`
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
}

// NewScanner creates a new workload scanner.
func NewScanner(c client.Client, clusterID string) *Scanner {
	return &Scanner{client: c, clusterID: clusterID}
}

// ScanNamespace discovers all workloads in a namespace.
func (s *Scanner) ScanNamespace(ctx context.Context, namespace string) ([]DiscoveredWorkload, error) {
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
			Containers: extractContainers(d.Spec.Template.Spec.Containers),
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
			Containers: extractContainers(ss.Spec.Template.Spec.Containers),
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
			Containers: extractContainers(ds.Spec.Template.Spec.Containers),
		})
	}

	return workloads, nil
}

// systemNamespaces are namespaces to skip during cluster-wide scans.
var systemNamespaces = map[string]bool{
	"kube-system":     true,
	"kube-public":     true,
	"kube-node-lease": true,
	"local-path-storage": true,
}

// ScanCluster discovers all workloads across user namespaces.
// System namespaces (kube-system, kube-public, etc.) are excluded.
func (s *Scanner) ScanCluster(ctx context.Context) ([]DiscoveredWorkload, error) {
	var namespaces corev1.NamespaceList
	if err := s.client.List(ctx, &namespaces); err != nil {
		return nil, fmt.Errorf("listing namespaces: %w", err)
	}

	var allWorkloads []DiscoveredWorkload
	for _, ns := range namespaces.Items {
		if systemNamespaces[ns.Name] {
			continue
		}
		workloads, err := s.ScanNamespace(ctx, ns.Name)
		if err != nil {
			// Log but don't fail the whole scan for one namespace
			continue
		}
		allWorkloads = append(allWorkloads, workloads...)
	}

	return allWorkloads, nil
}

// extractContainers extracts container info from pod spec containers.
func extractContainers(containers []corev1.Container) []ContainerInfo {
	var infos []ContainerInfo

	for _, c := range containers {
		info := ContainerInfo{
			Name:  c.Name,
			Image: c.Image,
		}

		// Extract env vars
		for _, env := range c.Env {
			ev := EnvVarInfo{Name: env.Name}

			if env.ValueFrom != nil {
				if env.ValueFrom.ConfigMapKeyRef != nil {
					ev.Source = fmt.Sprintf("configmap:%s/%s", env.ValueFrom.ConfigMapKeyRef.Name, env.ValueFrom.ConfigMapKeyRef.Key)
					info.ConfigMapRefs = append(info.ConfigMapRefs, ConfigMapRef{
						Name: env.ValueFrom.ConfigMapKeyRef.Name,
						Key:  env.ValueFrom.ConfigMapKeyRef.Key,
					})
				} else if env.ValueFrom.SecretKeyRef != nil {
					ev.Source = fmt.Sprintf("secret:%s/%s", env.ValueFrom.SecretKeyRef.Name, env.ValueFrom.SecretKeyRef.Key)
					ev.IsMasked = true
					info.SecretRefs = append(info.SecretRefs, SecretRef{
						Name: env.ValueFrom.SecretKeyRef.Name,
						Key:  env.ValueFrom.SecretKeyRef.Key,
					})
				}
			} else {
				ev.Value = env.Value
			}

			// Check if managed by Vexil
			if len(env.Name) > 5 && env.Name[:5] == "FLAG_" {
				ev.IsFlag = true
				ev.FlagName = env.Name[5:]
			}

			info.EnvVars = append(info.EnvVars, ev)
		}

		// Extract envFrom references
		for _, envFrom := range c.EnvFrom {
			if envFrom.ConfigMapRef != nil {
				info.ConfigMapRefs = append(info.ConfigMapRefs, ConfigMapRef{
					Name: envFrom.ConfigMapRef.Name,
				})
			}
			if envFrom.SecretRef != nil {
				info.SecretRefs = append(info.SecretRefs, SecretRef{
					Name: envFrom.SecretRef.Name,
				})
			}
		}

		infos = append(infos, info)
	}

	return infos
}
