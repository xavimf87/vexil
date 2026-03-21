package v1alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// FlagType defines the data type of a feature flag.
type FlagType string

const (
	FlagTypeBoolean FlagType = "boolean"
	FlagTypeString  FlagType = "string"
	FlagTypeInteger FlagType = "integer"
	FlagTypeJSON    FlagType = "json"
)

// FlagLifecycle defines the lifecycle stage of a feature flag.
type FlagLifecycle string

const (
	FlagLifecycleActive     FlagLifecycle = "active"
	FlagLifecycleDeprecated FlagLifecycle = "deprecated"
	FlagLifecycleArchived   FlagLifecycle = "archived"
)

// FlagPhase describes the current state of a feature flag.
type FlagPhase string

const (
	FlagPhasePending    FlagPhase = "Pending"
	FlagPhaseActive     FlagPhase = "Active"
	FlagPhaseRollingOut FlagPhase = "RollingOut"
	FlagPhaseFailed     FlagPhase = "Failed"
	FlagPhaseDisabled   FlagPhase = "Disabled"
)

// ConditionOperator defines operators for targeting conditions.
type ConditionOperator string

const (
	OpEq      ConditionOperator = "eq"
	OpNeq     ConditionOperator = "neq"
	OpIn      ConditionOperator = "in"
	OpNotIn   ConditionOperator = "notin"
	OpMatches ConditionOperator = "matches"
)

// RolloutStrategy defines how a flag value change is rolled out.
type RolloutStrategy string

const (
	RolloutImmediate RolloutStrategy = "immediate"
	RolloutCanary    RolloutStrategy = "canary"
	RolloutLinear    RolloutStrategy = "linear"
)

// FeatureFlagSpec defines the desired state of a FeatureFlag.
type FeatureFlagSpec struct {
	// Description is a human-readable description of the flag.
	// +optional
	Description string `json:"description,omitempty"`

	// Type is the data type of the flag value.
	// +kubebuilder:validation:Enum=boolean;string;integer;json
	Type FlagType `json:"type"`

	// DefaultValue is the default value when no targeting rules match.
	DefaultValue string `json:"defaultValue"`

	// Rules are targeting rules evaluated in order; first match wins.
	// +optional
	Rules []TargetingRule `json:"rules,omitempty"`

	// Delivery defines how the flag is delivered to workloads.
	// +optional
	Delivery *DeliverySpec `json:"delivery,omitempty"`

	// Rollout defines progressive rollout configuration.
	// +optional
	Rollout *RolloutSpec `json:"rollout,omitempty"`

	// Disabled is a kill switch that disables the flag globally.
	// +optional
	Disabled bool `json:"disabled,omitempty"`

	// Lifecycle is the current lifecycle stage of the flag.
	// +kubebuilder:default=active
	// +optional
	Lifecycle FlagLifecycle `json:"lifecycle,omitempty"`
}

// TargetingRule defines a rule for targeting specific workloads.
type TargetingRule struct {
	// Name is a human-readable label for this rule.
	Name string `json:"name"`

	// Conditions are evaluated with AND logic; all must be true.
	Conditions []Condition `json:"conditions"`

	// Value is returned when this rule matches.
	Value string `json:"value"`

	// Percentage of matching targets that receive this value (0-100).
	// +kubebuilder:validation:Minimum=0
	// +kubebuilder:validation:Maximum=100
	// +optional
	Percentage *int32 `json:"percentage,omitempty"`
}

// Condition defines a single condition within a targeting rule.
type Condition struct {
	// Attribute to evaluate: namespace, label:<key>, annotation:<key>, workload-name.
	Attribute string `json:"attribute"`

	// Operator to use for comparison.
	// +kubebuilder:validation:Enum=eq;neq;in;notin;matches
	Operator ConditionOperator `json:"operator"`

	// Values to compare against.
	Values []string `json:"values"`
}

// DeliverySpec defines how a flag value is delivered to workloads.
type DeliverySpec struct {
	// EnvVar injects the flag as an environment variable.
	// +optional
	EnvVar *EnvVarDelivery `json:"envVar,omitempty"`

	// ConfigMap writes the flag to a ConfigMap.
	// +optional
	ConfigMap *ConfigMapDelivery `json:"configMap,omitempty"`

	// Sidecar exposes the flag via a local sidecar API.
	// +optional
	Sidecar *SidecarDelivery `json:"sidecar,omitempty"`
}

// EnvVarDelivery configures env var injection.
type EnvVarDelivery struct {
	// Name of the environment variable. Defaults to FLAG_<UPPERCASE_FLAG_NAME>.
	// +optional
	Name string `json:"name,omitempty"`

	// Selector targets workloads by labels.
	Selector *metav1.LabelSelector `json:"selector"`
}

// ConfigMapDelivery configures ConfigMap-based delivery.
type ConfigMapDelivery struct {
	// ConfigMapName is the name of the ConfigMap to write to.
	ConfigMapName string `json:"configMapName"`

	// Key is the key within the ConfigMap.
	Key string `json:"key"`

	// Selector targets workloads by labels.
	Selector *metav1.LabelSelector `json:"selector"`
}

// SidecarDelivery configures sidecar-based delivery.
type SidecarDelivery struct {
	// Port the sidecar listens on.
	// +kubebuilder:default=8514
	// +optional
	Port int32 `json:"port,omitempty"`

	// Selector targets workloads by labels.
	Selector *metav1.LabelSelector `json:"selector"`
}

// RolloutSpec defines progressive rollout configuration.
type RolloutSpec struct {
	// Strategy defines the rollout approach.
	// +kubebuilder:validation:Enum=immediate;canary;linear
	Strategy RolloutStrategy `json:"strategy"`

	// Steps define the rollout progression.
	// +optional
	Steps []RolloutStep `json:"steps,omitempty"`
}

// RolloutStep defines a single step in a progressive rollout.
type RolloutStep struct {
	// Percentage of traffic for this step.
	// +kubebuilder:validation:Minimum=0
	// +kubebuilder:validation:Maximum=100
	Percentage int32 `json:"percentage"`

	// Duration to wait before moving to the next step.
	Duration metav1.Duration `json:"duration"`
}

// FeatureFlagStatus defines the observed state of a FeatureFlag.
type FeatureFlagStatus struct {
	// Phase is the current state of the flag.
	Phase FlagPhase `json:"phase,omitempty"`

	// CurrentValue is the effective value after rollout computation.
	CurrentValue string `json:"currentValue,omitempty"`

	// RolloutProgress is the current rollout percentage (0-100).
	RolloutProgress int32 `json:"rolloutProgress,omitempty"`

	// TargetedWorkloads is the number of workloads receiving this flag.
	TargetedWorkloads int32 `json:"targetedWorkloads,omitempty"`

	// LastUpdated is the last time the flag value was changed.
	// +optional
	LastUpdated *metav1.Time `json:"lastUpdated,omitempty"`

	// Conditions represent the latest available observations.
	// +optional
	Conditions []metav1.Condition `json:"conditions,omitempty"`

	// ObservedGeneration is the most recent generation observed.
	ObservedGeneration int64 `json:"observedGeneration,omitempty"`
}

// +kubebuilder:object:root=true
// +kubebuilder:subresource:status
// +kubebuilder:printcolumn:name="Type",type=string,JSONPath=`.spec.type`
// +kubebuilder:printcolumn:name="Default",type=string,JSONPath=`.spec.defaultValue`
// +kubebuilder:printcolumn:name="Phase",type=string,JSONPath=`.status.phase`
// +kubebuilder:printcolumn:name="Targeted",type=integer,JSONPath=`.status.targetedWorkloads`
// +kubebuilder:printcolumn:name="Age",type=date,JSONPath=`.metadata.creationTimestamp`

// FeatureFlag is the Schema for the featureflags API.
type FeatureFlag struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   FeatureFlagSpec   `json:"spec,omitempty"`
	Status FeatureFlagStatus `json:"status,omitempty"`
}

// +kubebuilder:object:root=true

// FeatureFlagList contains a list of FeatureFlag.
type FeatureFlagList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []FeatureFlag `json:"items"`
}

func init() {
	SchemeBuilder.Register(&FeatureFlag{}, &FeatureFlagList{})
}
