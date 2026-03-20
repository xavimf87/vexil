package controllers

import (
	"context"
	"fmt"
	"strings"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/log"

	vexilv1alpha1 "github.com/vexil-platform/vexil/pkg/apis/v1alpha1"
)

// FeatureFlagReconciler reconciles a FeatureFlag object.
type FeatureFlagReconciler struct {
	client.Client
	Scheme *runtime.Scheme
}

// +kubebuilder:rbac:groups=vexil.io,resources=featureflags,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=vexil.io,resources=featureflags/status,verbs=get;update;patch
// +kubebuilder:rbac:groups=apps,resources=deployments,verbs=get;list;watch;update;patch
// +kubebuilder:rbac:groups=apps,resources=statefulsets,verbs=get;list;watch;update;patch
// +kubebuilder:rbac:groups=apps,resources=daemonsets,verbs=get;list;watch;update;patch
// +kubebuilder:rbac:groups="",resources=configmaps,verbs=get;list;watch;create;update;patch

func (r *FeatureFlagReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	logger := log.FromContext(ctx)

	// Fetch the FeatureFlag
	var flag vexilv1alpha1.FeatureFlag
	if err := r.Get(ctx, req.NamespacedName, &flag); err != nil {
		if errors.IsNotFound(err) {
			return ctrl.Result{}, nil
		}
		return ctrl.Result{}, err
	}

	logger.Info("Reconciling FeatureFlag", "name", flag.Name, "namespace", flag.Namespace)

	// Determine effective value
	effectiveValue := flag.Spec.DefaultValue
	if flag.Spec.Disabled {
		return r.updateStatus(ctx, &flag, vexilv1alpha1.FlagPhaseDisabled, effectiveValue, 0)
	}

	// Deliver the flag based on delivery spec
	var targetedWorkloads int32
	if flag.Spec.Delivery != nil {
		var err error

		if flag.Spec.Delivery.EnvVar != nil {
			targetedWorkloads, err = r.deliverViaEnvVar(ctx, &flag, effectiveValue)
			if err != nil {
				logger.Error(err, "Failed to deliver via env var")
				return r.updateStatus(ctx, &flag, vexilv1alpha1.FlagPhaseFailed, effectiveValue, 0)
			}
		}

		if flag.Spec.Delivery.ConfigMap != nil {
			err = r.deliverViaConfigMap(ctx, &flag, effectiveValue)
			if err != nil {
				logger.Error(err, "Failed to deliver via ConfigMap")
				return r.updateStatus(ctx, &flag, vexilv1alpha1.FlagPhaseFailed, effectiveValue, 0)
			}
		}
	}

	return r.updateStatus(ctx, &flag, vexilv1alpha1.FlagPhaseActive, effectiveValue, targetedWorkloads)
}

// deliverViaEnvVar injects the flag value as an environment variable into matching deployments.
func (r *FeatureFlagReconciler) deliverViaEnvVar(ctx context.Context, flag *vexilv1alpha1.FeatureFlag, value string) (int32, error) {
	logger := log.FromContext(ctx)
	delivery := flag.Spec.Delivery.EnvVar

	// Determine env var name
	envName := delivery.Name
	if envName == "" {
		envName = "FLAG_" + strings.ToUpper(strings.ReplaceAll(flag.Name, "-", "_"))
	}

	// Convert label selector
	selector, err := metav1.LabelSelectorAsSelector(delivery.Selector)
	if err != nil {
		return 0, fmt.Errorf("invalid label selector: %w", err)
	}

	var targeted int32

	// Update Deployments
	var deployments appsv1.DeploymentList
	if err := r.List(ctx, &deployments, client.InNamespace(flag.Namespace), client.MatchingLabelsSelector{Selector: selector}); err != nil {
		return 0, fmt.Errorf("listing deployments: %w", err)
	}

	for i := range deployments.Items {
		deploy := &deployments.Items[i]
		updated := false

		for ci := range deploy.Spec.Template.Spec.Containers {
			container := &deploy.Spec.Template.Spec.Containers[ci]
			found := false

			for ei := range container.Env {
				if container.Env[ei].Name == envName {
					if container.Env[ei].Value != value {
						container.Env[ei].Value = value
						updated = true
					}
					found = true
					break
				}
			}

			if !found {
				container.Env = append(container.Env, corev1.EnvVar{
					Name:  envName,
					Value: value,
				})
				updated = true
			}
		}

		if updated {
			// Add annotation to track which flags are injected
			if deploy.Spec.Template.Annotations == nil {
				deploy.Spec.Template.Annotations = make(map[string]string)
			}
			deploy.Spec.Template.Annotations["vexil.io/flags-hash"] = fmt.Sprintf("%s=%s", flag.Name, value)

			if err := r.Update(ctx, deploy); err != nil {
				return 0, fmt.Errorf("updating deployment %s: %w", deploy.Name, err)
			}
			logger.Info("Updated deployment with flag env var",
				"deployment", deploy.Name,
				"envVar", envName,
				"value", value,
			)
		}
		targeted++
	}

	return targeted, nil
}

// deliverViaConfigMap writes the flag value to a ConfigMap.
func (r *FeatureFlagReconciler) deliverViaConfigMap(ctx context.Context, flag *vexilv1alpha1.FeatureFlag, value string) error {
	logger := log.FromContext(ctx)
	delivery := flag.Spec.Delivery.ConfigMap

	// Try to get existing ConfigMap
	var cm corev1.ConfigMap
	cmKey := client.ObjectKey{
		Namespace: flag.Namespace,
		Name:      delivery.ConfigMapName,
	}

	if err := r.Get(ctx, cmKey, &cm); err != nil {
		if errors.IsNotFound(err) {
			// Create the ConfigMap
			cm = corev1.ConfigMap{
				ObjectMeta: metav1.ObjectMeta{
					Name:      delivery.ConfigMapName,
					Namespace: flag.Namespace,
					Labels: map[string]string{
						"app.kubernetes.io/managed-by": "vexil",
					},
				},
				Data: map[string]string{
					delivery.Key: value,
				},
			}
			if err := r.Create(ctx, &cm); err != nil {
				return fmt.Errorf("creating configmap: %w", err)
			}
			logger.Info("Created ConfigMap for flag", "configMap", delivery.ConfigMapName)
			return nil
		}
		return fmt.Errorf("getting configmap: %w", err)
	}

	// Update existing ConfigMap
	if cm.Data == nil {
		cm.Data = make(map[string]string)
	}

	if cm.Data[delivery.Key] != value {
		cm.Data[delivery.Key] = value
		if err := r.Update(ctx, &cm); err != nil {
			return fmt.Errorf("updating configmap: %w", err)
		}
		logger.Info("Updated ConfigMap with flag value",
			"configMap", delivery.ConfigMapName,
			"key", delivery.Key,
		)
	}

	return nil
}

// updateStatus updates the FeatureFlag status.
func (r *FeatureFlagReconciler) updateStatus(
	ctx context.Context,
	flag *vexilv1alpha1.FeatureFlag,
	phase vexilv1alpha1.FlagPhase,
	currentValue string,
	targetedWorkloads int32,
) (ctrl.Result, error) {
	now := metav1.Now()
	flag.Status.Phase = phase
	flag.Status.CurrentValue = currentValue
	flag.Status.TargetedWorkloads = targetedWorkloads
	flag.Status.LastUpdated = &now
	flag.Status.ObservedGeneration = flag.Generation

	if err := r.Status().Update(ctx, flag); err != nil {
		return ctrl.Result{}, fmt.Errorf("updating status: %w", err)
	}
	return ctrl.Result{}, nil
}

// SetupWithManager sets up the controller with the Manager.
func (r *FeatureFlagReconciler) SetupWithManager(mgr ctrl.Manager) error {
	return ctrl.NewControllerManagedBy(mgr).
		For(&vexilv1alpha1.FeatureFlag{}).
		Complete(r)
}

// Ensure labels selector is used (suppress unused import)
var _ = labels.Everything
