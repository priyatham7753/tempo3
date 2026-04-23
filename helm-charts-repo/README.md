# E-Commerce Platform — Production-Grade DevOps System

A complete, production-grade DevOps system for a microservices-based e-commerce application built with **Helm umbrella charts**, **Kubernetes Gateway API**, **GitHub Actions CI/CD**, and **Argo CD GitOps**.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Single Kubernetes Cluster                        │
│                                                                          │
│  ┌──────────────┐   ┌─────────────────────────────────────────────────┐ │
│  │   gateway ns  │   │                  frontend ns                    │ │
│  │               │   │  ┌────────────────────────────────────────────┐ │ │
│  │  NGINX GF     │──▶│  │           frontend (React)                 │ │ │
│  │  Gateway      │   │  └────────────────────────────────────────────┘ │ │
│  │  HTTPRoutes   │   └─────────────────────────────────────────────────┘ │
│  └───────┬───────┘                                                       │
│          │            ┌─────────────────────────────────────────────────┐ │
│          └──────────▶ │                  backend ns                     │ │
│                       │  ┌───────────┐  ┌─────────────┐  ┌──────────┐  │ │
│                       │  │auth-svc   │  │product-svc  │  │order-svc │  │ │
│                       │  │Node.js    │  │Node.js      │  │FastAPI   │  │ │
│                       │  └─────┬─────┘  └──────┬──────┘  └────┬─────┘  │ │
│                       └────────┼───────────────┼───────────────┼────────┘ │
│                                │               │               │          │
│  ┌─────────────────────────────┼───────────────┼───────────────┼────────┐ │
│  │              database ns    │               │               │        │ │
│  │  ┌──────────────┐  ┌────────┴──────┐  ┌────┴──────────┐           │ │
│  │  │ mongodb-auth │  │mongodb-product│  │ mongodb-order │           │ │
│  │  │ StatefulSet  │  │ StatefulSet   │  │  StatefulSet  │           │ │
│  │  │ NFS PVC      │  │ NFS PVC       │  │  NFS PVC      │           │ │
│  │  └──────────────┘  └───────────────┘  └───────────────┘           │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Namespace Strategy

> **CRITICAL:** Only **functional** namespaces are used. There are NO `dev` or `prod` namespaces.

| Namespace  | Purpose                                        |
|------------|------------------------------------------------|
| `frontend` | React frontend Deployment + Service            |
| `backend`  | All microservices (auth, product, order)       |
| `database` | All MongoDB StatefulSets + Headless Services   |
| `gateway`  | NGINX Gateway Fabric + HTTPRoutes              |

### Why Functional Namespaces?

Splitting by **function** (not environment) is the correct single-cluster pattern because:

- Network policies map naturally to communication boundaries
- RBAC maps naturally to teams (frontend-team, backend-team, DBA)
- Dev vs Prod differentiation is handled **correctly** — via Helm values, not topology

---

## Environment Strategy

> Dev and Prod are **values-only** concepts. The Helm templates are identical between them.

| Aspect           | Dev                       | Prod                          |
|------------------|---------------------------|-------------------------------|
| Image Tag        | `sha-<commit>` (SHA only) | `v1.0.0` (semver)             |
| Replicas         | 1 per service             | 2 per service                 |
| Resources        | Reduced limits            | Full limits                   |
| MongoDB Storage  | 2Gi per instance          | 20Gi per instance             |
| NODE_ENV         | `development`             | `production`                  |
| Argo CD App      | `ecommerce-dev`           | `ecommerce-prod`              |
| Values applied   | `values.yaml` + `values-dev.yaml` | `values.yaml` + `values-prod.yaml` |

---

## Helm Chart Structure

```
helm-charts-repo/
├── .github/
│   └── workflows/                      # CI pipelines (per service)
│       ├── auth-service-ci-dev.yaml
│       ├── auth-service-ci-prod.yaml
│       ├── product-service-ci-dev.yaml
│       ├── product-service-ci-prod.yaml
│       ├── order-service-ci-dev.yaml
│       ├── order-service-ci-prod.yaml
│       └── frontend-ci.yaml
│
├── ecommerce-platform/                 # Umbrella chart root
│   ├── Chart.yaml                      # Dependencies via file://charts/<name>
│   ├── values.yaml                     # Global baseline + subchart defaults
│   ├── values-dev.yaml                 # Dev overrides (SHA tags, low replicas)
│   ├── values-prod.yaml                # Prod overrides (semver tags, 2x replicas)
│   └── charts/                         # ALL subcharts live here
│       ├── frontend/
│       │   ├── Chart.yaml
│       │   ├── values.yaml
│       │   └── templates/
│       │       ├── configmap.yaml
│       │       ├── deployment.yaml
│       │       ├── service.yaml
│       │       └── networkpolicy.yaml
│       ├── auth-service/
│       │   ├── Chart.yaml
│       │   ├── values.yaml
│       │   └── templates/
│       │       ├── configmap.yaml
│       │       ├── secret.yaml
│       │       ├── deployment.yaml
│       │       ├── service.yaml
│       │       └── networkpolicy.yaml
│       ├── product-service/            # Same structure as auth-service
│       ├── order-service/              # Same structure as auth-service
│       ├── mongodb-auth/
│       │   ├── Chart.yaml
│       │   ├── values.yaml
│       │   └── templates/
│       │       └── all.yaml            # Secret, Headless SVC, PVC, StatefulSet, NetPol
│       ├── mongodb-product/            # Same structure as mongodb-auth
│       └── mongodb-order/              # Same structure as mongodb-auth
│
├── gitops/
│   ├── argocd/
│   │   └── appproject.yaml
│   └── environments/
│       ├── dev/
│       │   └── application.yaml        # ArgoCD Application (ecommerce-dev)
│       └── prod/
│           └── application.yaml        # ArgoCD Application (ecommerce-prod)
│
└── k8s/
    ├── 00-namespaces.yaml              # All 4 functional namespaces
    ├── 01-nfs-storage.yaml             # StorageClass + 3 PersistentVolumes
    └── 02-gateway-api.yaml             # GatewayClass, Gateway, HTTPRoutes, ReferenceGrants
```

---

## Prerequisites

```bash
# 1. Install NGINX Gateway Fabric CRDs
kubectl apply -f https://github.com/nginx/nginx-gateway-fabric/releases/download/v1.4.0/crds.yaml

# 2. Install NGINX Gateway Fabric controller
helm install ngf oci://ghcr.io/nginx/charts/nginx-gateway-fabric \
  --namespace gateway --create-namespace \
  --set service.type=LoadBalancer

# 3. Install Argo CD
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# 4. Apply infrastructure manifests (namespaces, storage, gateway)
kubectl apply -f k8s/00-namespaces.yaml
kubectl apply -f k8s/01-nfs-storage.yaml   # Edit NFS_SERVER_IP first
kubectl apply -f k8s/02-gateway-api.yaml

# 5. Apply ArgoCD project + applications
kubectl apply -f gitops/argocd/appproject.yaml
kubectl apply -f gitops/environments/dev/application.yaml
kubectl apply -f gitops/environments/prod/application.yaml
```

---

## Helm Usage

### Bootstrap dependencies (run once after cloning)
```bash
cd ecommerce-platform
helm dependency update
```

### Deploy to Dev (manual — normally done by Argo CD)
```bash
helm upgrade --install ecommerce-dev ./ecommerce-platform \
  -f ecommerce-platform/values.yaml \
  -f ecommerce-platform/values-dev.yaml \
  --create-namespace
```

### Deploy to Prod (manual — normally done by Argo CD)
```bash
helm upgrade --install ecommerce-prod ./ecommerce-platform \
  -f ecommerce-platform/values.yaml \
  -f ecommerce-platform/values-prod.yaml \
  --create-namespace
```

### Lint / Dry-run
```bash
helm lint ecommerce-platform/
helm template ecommerce-dev ./ecommerce-platform \
  -f ecommerce-platform/values.yaml \
  -f ecommerce-platform/values-dev.yaml | kubectl apply --dry-run=client -f -
```

---

## CI/CD Flow

### Dev Flow (on `push` to `develop` branch)

```
Service Repo (develop)
        │
        ▼
┌───────────────────┐
│  GitHub Actions   │
│  1. npm ci / pip  │
│  2. npm test      │
│  3. SonarQube     │
│  4. Snyk scan     │
│  5. Docker build  │
│     tag: sha-XXX  │  ← SHA-only tag
│  6. Trivy scan    │
│  7. Docker push   │
│  8. yq update     │
│     values-dev.yaml│
│     image.tag     │
│     = sha-XXX     │
│  9. git push →    │
│     helm-charts-  │
│     repo/main     │
│ 10. ArgoCD sync   │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│    Argo CD        │
│  ecommerce-dev    │
│  auto-detects     │
│  values-dev.yaml  │
│  change, syncs    │
│  cluster          │
└───────────────────┘
```

### Prod Flow (on `push` of `v*.*.*` tag to `main`)

```
Service Repo (tag v1.0.0)
        │
        ▼
┌────────────────────┐
│  GitHub Actions    │
│  1–4. Same as dev  │
│  5. Quality Gate   │  ← Mandatory in prod
│  6. Docker build   │
│     tag: sha-XXX   │  ← SHA tag (audit)
│     tag: v1.0.0    │  ← Semver tag (deploy)
│  7. Trivy (H+C)    │  ← Stricter threshold
│  8. Docker push    │
│     both tags      │
│  9. yq update      │
│     values-prod.yaml│
│     image.tag      │
│     = v1.0.0       │
│ 10. git push       │
│ 11. ArgoCD sync    │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│    Argo CD         │
│  ecommerce-prod    │
│  auto-detects      │
│  values-prod.yaml  │
│  change, syncs     │
│  cluster           │
└────────────────────┘
```

---

## Network Policy Summary

| From           | To                | Allowed? |
|----------------|-------------------|----------|
| Gateway ns     | frontend:80       | ✅       |
| Gateway ns     | auth-svc:3001     | ✅       |
| Gateway ns     | product-svc:3002  | ✅       |
| Gateway ns     | order-svc:8000    | ✅       |
| frontend ns    | auth-svc:3001     | ✅       |
| frontend ns    | product-svc:3002  | ✅       |
| frontend ns    | order-svc:8000    | ✅       |
| order-svc      | auth-svc:3001     | ✅       |
| order-svc      | product-svc:3002  | ✅       |
| auth-svc       | mongodb-auth:27017| ✅       |
| product-svc    | mongodb-product:27017| ✅    |
| order-svc      | mongodb-order:27017| ✅     |
| auth-svc       | mongodb-product/order| ❌   |
| product-svc    | mongodb-auth/order| ❌      |
| Any            | Anything else     | ❌       |

---

## GitHub Actions Secrets Required

| Secret              | Description                               |
|---------------------|-------------------------------------------|
| `DOCKER_USERNAME`   | Docker Hub username                       |
| `DOCKER_PASSWORD`   | Docker Hub password / access token        |
| `HELM_REPO_SSH_KEY` | SSH private key for helm-charts-repo push |
| `SONAR_TOKEN`       | SonarQube authentication token            |
| `SONAR_HOST_URL`    | SonarQube server URL                      |
| `SNYK_TOKEN`        | Snyk API token                            |
| `ARGOCD_SERVER`     | Argo CD server URL (https://...)          |
| `ARGOCD_TOKEN`      | Argo CD API token (via RBAC)              |

---

## Global Values Reference

All subcharts read from `.Values.global.*`:

| Key                          | Description                            |
|------------------------------|----------------------------------------|
| `global.environment`         | `dev` or `prod` (informational label)  |
| `global.imageRegistry`       | Docker registry prefix                 |
| `global.namespaces.frontend` | Namespace for frontend workloads       |
| `global.namespaces.backend`  | Namespace for backend microservices    |
| `global.namespaces.database` | Namespace for MongoDB StatefulSets     |
| `global.namespaces.gateway`  | Namespace for Gateway resources        |
| `global.mongodb.username`    | Shared MongoDB root username           |
| `global.mongodb.password`    | Shared MongoDB root password           |
| `global.resources.limits`    | CPU/memory limits for all services     |
| `global.resources.requests`  | CPU/memory requests for all services   |
| `global.jwtSecret`           | JWT signing secret                     |
