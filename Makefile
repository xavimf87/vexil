IMG_OPERATOR ?= ghcr.io/vexil-platform/operator:latest
IMG_APISERVER ?= ghcr.io/vexil-platform/apiserver:latest
IMG_WEB ?= ghcr.io/vexil-platform/web:latest

.PHONY: all build test lint fmt vet operator apiserver web install uninstall docker-build docker-push run-operator run-apiserver run-web

all: build

##@ Build

build: operator apiserver

operator:
	go build -o bin/vexil-operator ./cmd/operator

apiserver:
	go build -o bin/vexil-apiserver ./cmd/apiserver

##@ Development

run-operator:
	go run ./cmd/operator --metrics-bind-address=:8080 --health-probe-bind-address=:8081

run-apiserver:
	go run ./cmd/apiserver --port=8090

run-web:
	cd web && npm run dev

fmt:
	go fmt ./...

vet:
	go vet ./...

lint:
	golangci-lint run

test:
	go test ./... -coverprofile cover.out

##@ Kubernetes

install: ## Install CRDs into the cluster
	kubectl apply -f config/crd/bases/

uninstall: ## Uninstall CRDs from the cluster
	kubectl delete -f config/crd/bases/

deploy: install ## Deploy operator + apiserver to the cluster
	kubectl apply -f config/rbac/
	kubectl apply -f config/manager/

sample: ## Apply sample FeatureFlags
	kubectl apply -f config/samples/

##@ Docker

docker-build: ## Build all Docker images
	docker build -f Dockerfile.operator -t $(IMG_OPERATOR) .
	docker build -f Dockerfile.apiserver -t $(IMG_APISERVER) .
	docker build -f Dockerfile.web -t $(IMG_WEB) .

docker-push:
	docker push $(IMG_OPERATOR)
	docker push $(IMG_APISERVER)

##@ Helm

HELM_VALUES ?= deploy/helm/vexil/values-dev.yaml

helm-install: ## Install Helm chart (uses values-dev.yaml by default)
	helm install vexil deploy/helm/vexil -n vexil-system --create-namespace -f $(HELM_VALUES)

helm-upgrade: ## Upgrade Helm chart
	helm upgrade vexil deploy/helm/vexil -n vexil-system -f $(HELM_VALUES)

helm-uninstall:
	helm uninstall vexil -n vexil-system

redeploy: docker-build ## Build all images and redeploy via Helm
	helm upgrade vexil deploy/helm/vexil -n vexil-system -f $(HELM_VALUES) --force-conflicts
	kubectl rollout restart deployment -n vexil-system -l app.kubernetes.io/part-of=vexil

##@ Cleanup

clean:
	rm -rf bin/ cover.out

help: ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_0-9-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)
