{{/*
Expand the name of the chart.
*/}}
{{- define "vexil.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "vexil.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "vexil.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Namespace to use
*/}}
{{- define "vexil.namespace" -}}
{{- default .Release.Namespace .Values.global.namespaceOverride }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "vexil.labels" -}}
helm.sh/chart: {{ include "vexil.chart" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: vexil
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}

{{/*
Operator labels
*/}}
{{- define "vexil.operator.labels" -}}
{{ include "vexil.labels" . }}
app.kubernetes.io/name: {{ include "vexil.fullname" . }}-operator
app.kubernetes.io/component: operator
{{- end }}

{{/*
Operator selector labels
*/}}
{{- define "vexil.operator.selectorLabels" -}}
app.kubernetes.io/name: {{ include "vexil.fullname" . }}-operator
app.kubernetes.io/component: operator
{{- end }}

{{/*
API Server labels
*/}}
{{- define "vexil.apiserver.labels" -}}
{{ include "vexil.labels" . }}
app.kubernetes.io/name: {{ include "vexil.fullname" . }}-apiserver
app.kubernetes.io/component: apiserver
{{- end }}

{{/*
API Server selector labels
*/}}
{{- define "vexil.apiserver.selectorLabels" -}}
app.kubernetes.io/name: {{ include "vexil.fullname" . }}-apiserver
app.kubernetes.io/component: apiserver
{{- end }}

{{/*
Web labels
*/}}
{{- define "vexil.web.labels" -}}
{{ include "vexil.labels" . }}
app.kubernetes.io/name: {{ include "vexil.fullname" . }}-web
app.kubernetes.io/component: web
{{- end }}

{{/*
Web selector labels
*/}}
{{- define "vexil.web.selectorLabels" -}}
app.kubernetes.io/name: {{ include "vexil.fullname" . }}-web
app.kubernetes.io/component: web
{{- end }}

{{/*
Service account name
*/}}
{{- define "vexil.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "vexil.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Operator image
*/}}
{{- define "vexil.operator.image" -}}
{{ .Values.operator.image.repository }}:{{ .Values.operator.image.tag | default .Chart.AppVersion }}
{{- end }}

{{/*
API Server image
*/}}
{{- define "vexil.apiserver.image" -}}
{{ .Values.apiserver.image.repository }}:{{ .Values.apiserver.image.tag | default .Chart.AppVersion }}
{{- end }}

{{/*
Web image
*/}}
{{- define "vexil.web.image" -}}
{{ .Values.web.image.repository }}:{{ .Values.web.image.tag | default .Chart.AppVersion }}
{{- end }}

{{/*
PostgreSQL host
*/}}
{{- define "vexil.postgresql.host" -}}
{{- if .Values.postgresql.enabled }}
{{- printf "%s-postgresql" (include "vexil.fullname" .) }}
{{- else }}
{{- required "apiserver.databaseURL is required when postgresql.enabled is false" .Values.apiserver.databaseURL }}
{{- end }}
{{- end }}

{{/*
Database URL
*/}}
{{- define "vexil.databaseURL" -}}
{{- if .Values.apiserver.databaseURL }}
{{- .Values.apiserver.databaseURL }}
{{- else if .Values.postgresql.enabled }}
{{- printf "postgres://%s:$(POSTGRES_PASSWORD)@%s:5432/%s?sslmode=disable" .Values.postgresql.auth.username (include "vexil.postgresql.host" .) .Values.postgresql.auth.database }}
{{- end }}
{{- end }}

{{/*
PostgreSQL secret name
*/}}
{{- define "vexil.postgresql.secretName" -}}
{{- if .Values.postgresql.auth.existingSecret }}
{{- .Values.postgresql.auth.existingSecret }}
{{- else }}
{{- printf "%s-postgresql" (include "vexil.fullname" .) }}
{{- end }}
{{- end }}

{{/*
Image pull secrets
*/}}
{{- define "vexil.imagePullSecrets" -}}
{{- with .Values.global.imagePullSecrets }}
imagePullSecrets:
  {{- toYaml . | nindent 2 }}
{{- end }}
{{- end }}
