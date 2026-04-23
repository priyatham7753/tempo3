# E-Commerce Platform — Production-Grade Microservices DevOps System

> Umbrella Helm Chart · Functional Namespaces · NGINX Gateway Fabric · Argo CD GitOps

---

## Architecture Overview

```
Internet
   │
   ▼
NGINX Gateway Fabric (namespace: gateway)
   ├── /              → frontend:80          (namespace: frontend)
   ├── /api/auth      → auth-service:3001    (namespace: backend)
   ├── /api/products  → product-service:3002 (namespace: backend)
   └── /api/orders    → order-service:8000   (namespace: backend)

Each backend service → own dedicated MongoDB StatefulSet (namespace: database)
All MongoDB data persisted on NFS PersistentVolumes
NetworkPolicy: Default-Deny-All + per-service allowlists
Dev vs Prod = Helm values files ONLY (no separate namespaces/clusters)
```

### Services

| Service | Language | Port | Database |
|---------|----------|------|----------|
| frontend | React + Nginx | 80 | — |
| auth-service | Node.js / Express | 3001 | mongodb-auth |
| product-service | Node.js / Express | 3002 | mongodb-product |
| order-service | Python / FastAPI | 8000 | mongodb-order |

---

## Namespace Strategy

> **Critical:** Only functional namespaces are used. Dev vs Prod is controlled **only** via Helm values files — never via namespaces or clusters.

| Namespace | Contains |
|-----------|----------|
| `frontend` | React frontend Deployment + Service |
| `backend` | auth-service, product-service, order-service |
| `database` | 3× MongoDB StatefulSets + Headless Services + PVCs |
| `gateway` | NGINX Gateway Fabric controller + HTTPRoutes |

---

## Repository Structure

```
capstone/
├── frontend/
│   ├── src/                         # React source code
│   ├── Dockerfile
│   └── nginx.conf
│
├── auth-service/
│   ├── src/
│   └── Dockerfile
│
├── product-service/
│   ├── src/
│   └── Dockerfile
│
├── order-service/
│   ├── app/
│   ├── requirements.txt
│   └── Dockerfile
│
├── helm-charts-repo/                # Umbrella Helm chart (single deployable unit)
│   ├── README.md
│   ├── ecommerce-platform/          # Umbrella chart root
│   │   ├── Chart.yaml               # 7 dependencies via file://charts/<name>
│   │   ├── values.yaml              # Global baseline (namespaces, registry, resources)
│   │   ├── values-dev.yaml          # Dev overrides: SHA image tags, 1 replica
│   │   ├── values-prod.yaml         # Prod overrides: semver tags, 2 replicas
│   │   └── charts/                  # ALL subcharts live here
│   │       ├── frontend/
│   │       ├── auth-service/
│   │       ├── product-service/
│   │       ├── order-service/
│   │       ├── mongodb-auth/
│   │       ├── mongodb-product/
│   │       └── mongodb-order/
│   │
│   ├── gitops/
│   │   ├── argocd/appproject.yaml           # ArgoCD AppProject
│   │   └── environments/
│   │       ├── dev/application.yaml         # ArgoCD Application: ecommerce-dev
│   │       └── prod/application.yaml        # ArgoCD Application: ecommerce-prod
│   │
│   └── k8s/
│       ├── 00-namespaces.yaml       # 4 functional namespaces + default-deny policies
│       ├── 01-nfs-storage.yaml      # StorageClass + 3 PersistentVolumes (NFS)
│       └── 02-gateway-api.yaml      # GatewayClass + Gateway + ReferenceGrants + HTTPRoutes
│
├── k8s/                             # Original k8s manifests (same files, also used)
│   ├── 00-namespaces.yaml
│   ├── 01-nfs-storage.yaml
│   └── 02-gateway-api.yaml
│
├── gitops/                          # Original GitOps directory (legacy)
│
├── docker-compose.yml               # Local development only
├── DEPLOYMENT_STEPS.txt             # Full step-by-step cluster deployment guide
└── README.md                        # This file
```

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Kubernetes | 1.28+ | Container orchestration |
| kubectl | 1.28+ | Cluster management |
| Helm | 3.13+ | Chart deployment |
| Argo CD | 2.9+ | GitOps continuous delivery |
| NFS Server | — | Persistent storage for MongoDB |
| Docker Hub account | — | Container image registry |

---

## Quick Start Deployment

> For the full step-by-step guide with all commands, see **DEPLOYMENT_STEPS.txt**

### Step 1 — Configure NFS Server

```bash
ssh user@YOUR_NFS_IP

sudo mkdir -p /exports/mongodb-auth /exports/mongodb-product /exports/mongodb-order
sudo chmod 777 /exports/mongodb-auth /exports/mongodb-product /exports/mongodb-order

sudo tee -a /etc/exports <<EOF
/exports/mongodb-auth    *(rw,sync,no_subtree_check,no_root_squash)
/exports/mongodb-product *(rw,sync,no_subtree_check,no_root_squash)
/exports/mongodb-order   *(rw,sync,no_subtree_check,no_root_squash)
EOF

sudo exportfs -ra && sudo systemctl restart nfs-kernel-server
showmount -e localhost
```

### Step 2 — Create Namespaces & Network Policies

```bash
kubectl apply -f k8s/00-namespaces.yaml

# Verify
kubectl get namespaces | grep -E "frontend|backend|database|gateway"
kubectl get networkpolicy -A
```

### Step 3 — Create NFS Storage

```bash
# Replace NFS server IP first
sed -i 's/10.0.0.10/YOUR_NFS_IP/g' k8s/01-nfs-storage.yaml

kubectl apply -f k8s/01-nfs-storage.yaml

# Verify PVs are Available
kubectl get pv
# Must see: auth-mongodb-pv, product-mongodb-pv, order-mongodb-pv — STATUS: Available
```

### Step 4 — Install NGINX Gateway Fabric

```bash
# Install Gateway API CRDs
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.1.0/standard-install.yaml

# Install NGINX Gateway Fabric CRDs
kubectl apply -f https://raw.githubusercontent.com/nginx/nginx-gateway-fabric/v1.4.0/deploy/crds.yaml

# Install NGINX Gateway Fabric controller
helm install ngf oci://ghcr.io/nginx/charts/nginx-gateway-fabric \
  --namespace gateway \
  --create-namespace \
  --set service.type=LoadBalancer \
  --version 1.4.0

# Wait for controller
kubectl rollout status deployment/ngf-nginx-gateway-fabric -n gateway --timeout=120s

# Get external IP (your app's public entry point)
kubectl get svc -n gateway
```

### Step 5 — Apply Gateway Routes

```bash
kubectl apply -f k8s/02-gateway-api.yaml

# Verify
kubectl get gatewayclass          # nginx — ACCEPTED=True
kubectl get gateway -n gateway    # ecommerce-gateway — PROGRAMMED=True
kubectl get httproute -A          # frontend-route, auth-route, product-route, order-route
kubectl get referencegrant -A     # allow-gateway-to-frontend, allow-gateway-to-backend
```

### Step 6 — Bootstrap Umbrella Chart Dependencies

```bash
cd helm-charts-repo/ecommerce-platform

# Resolve all 7 file://charts/* dependencies declared in Chart.yaml
helm dependency update

cd ../..
```

### Step 7 — Deploy All Services (Single Command)

```bash
# DEV deployment — SHA image tags, 1 replica per service
helm upgrade --install ecommerce-dev \
  helm-charts-repo/ecommerce-platform \
  -f helm-charts-repo/ecommerce-platform/values.yaml \
  -f helm-charts-repo/ecommerce-platform/values-dev.yaml \
  --create-namespace \
  --atomic \
  --timeout 5m

# This deploys in one shot:
#   frontend (namespace: frontend)
#   auth-service, product-service, order-service (namespace: backend)
#   mongodb-auth, mongodb-product, mongodb-order (namespace: database)
```

```bash
# PROD deployment — semver image tags (v1.0.0), 2 replicas per service
helm upgrade --install ecommerce-prod \
  helm-charts-repo/ecommerce-platform \
  -f helm-charts-repo/ecommerce-platform/values.yaml \
  -f helm-charts-repo/ecommerce-platform/values-prod.yaml \
  --create-namespace \
  --atomic \
  --timeout 5m
```

### Step 8 — Install Argo CD

```bash
kubectl create namespace argocd
kubectl apply -n argocd \
  -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

kubectl rollout status deployment/argocd-server -n argocd --timeout=300s

# Get admin password
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d && echo

# Access UI
kubectl port-forward svc/argocd-server -n argocd 8080:443
# Open: https://localhost:8080  (admin / <password>)
```

### Step 9 — Apply Argo CD Applications

```bash
# AppProject (grants access to all 4 functional namespaces)
kubectl apply -f helm-charts-repo/gitops/argocd/appproject.yaml

# Dev Application — auto-syncs when values-dev.yaml changes
kubectl apply -f helm-charts-repo/gitops/environments/dev/application.yaml

# Prod Application — auto-syncs when values-prod.yaml changes
kubectl apply -f helm-charts-repo/gitops/environments/prod/application.yaml

# Watch sync status
kubectl get applications -n argocd
# ecommerce-dev   Synced  Healthy
# ecommerce-prod  Synced  Healthy
```

### Step 9 — Apply Argo CD Applications

```bash
# All pods healthy
kubectl get pods -A
# No CrashLoopBackOff, no Pending

# MongoDB StatefulSets and PVCs
kubectl get statefulsets -n database
kubectl get pvc -n database
# All PVCs must be Bound

# Backend services and endpoints
kubectl get svc -n backend
kubectl get endpoints -n backend

# Get Gateway external IP
GATEWAY_IP=$(kubectl get svc -n gateway \
  -o jsonpath='{.items[?(@.spec.type=="LoadBalancer")].status.loadBalancer.ingress[0].ip}')
echo "Gateway: http://$GATEWAY_IP"

# Test all routes
curl http://$GATEWAY_IP/                  # React frontend (HTML)
curl http://$GATEWAY_IP/api/auth/health   # Auth service
curl http://$GATEWAY_IP/api/products      # Product service
curl http://$GATEWAY_IP/api/orders        # Order service

# Argo CD — all apps synced
kubectl get applications -n argocd
```

---

## Troubleshooting

### `helm dependency update` fails
```bash
# Make sure you are inside the correct directory
cd helm-charts-repo/ecommerce-platform
ls charts/
# Must see 7 subdirectories: frontend, auth-service, product-service,
# order-service, mongodb-auth, mongodb-product, mongodb-order
```

### Pod: ImagePullBackOff
```bash
kubectl describe pod <pod> -n backend
# Fix: ensure docker.io/myrepo is set to YOUR Docker Hub org in values.yaml
# Fix: verify DOCKER_USERNAME / DOCKER_PASSWORD secrets in GitHub Actions
```

### PVC: Pending
```bash
kubectl describe pvc mongodb-auth-pvc -n database
# Fix: verify NFS IP in k8s/01-nfs-storage.yaml
# Fix: verify NFS exports: showmount -e YOUR_NFS_IP
# Fix: verify nfs-common installed on all worker nodes
```

### Pod: CrashLoopBackOff
```bash
kubectl logs <pod> -n backend --previous
# Fix: verify MONGO_URI in the service Secret is correct
# Fix: ensure MongoDB pod in 'database' namespace is Running first
kubectl get pods -n database
```

### Gateway: 502 Bad Gateway
```bash
kubectl get pods -n backend         # service pods must be Running
kubectl get httproute -A            # routes must show Accepted=True
kubectl get referencegrant -A       # both ReferenceGrants must exist
kubectl logs -n gateway -l app.kubernetes.io/name=nginx-gateway -f
```

### Gateway: HTTPRoute not routing (no parent match)
```bash
kubectl describe httproute auth-route -n gateway
# parentRefs name must match: ecommerce-gateway
# parentRefs namespace must match: gateway
kubectl get gateway -n gateway
```

### MongoDB: AuthenticationFailed
```bash
# Check Secret values match between MongoDB and the service
kubectl get secret mongodb-auth-secret -n database \
  -o jsonpath='{.data.MONGO_ROOT_PASSWORD}' | base64 -d

kubectl get secret auth-secret -n backend \
  -o jsonpath='{.data.MONGO_URI}' | base64 -d
# Both passwords must match global.mongodb.password in values.yaml
```

### Argo CD: OutOfSync
```bash
argocd app diff ecommerce-dev     # shows what's different
argocd app sync ecommerce-dev
# Fix: ensure repoURL in application.yaml matches your actual repo URL
```

---

## Network Policy Matrix

| Source | Destination | Port | Allowed |
|--------|-------------|------|---------|
| gateway ns | frontend:80 | 80 | ✅ |
| gateway ns | auth-service:3001 | 3001 | ✅ |
| gateway ns | product-service:3002 | 3002 | ✅ |
| gateway ns | order-service:8000 | 8000 | ✅ |
| frontend ns | auth/product/order | 3001/3002/8000 | ✅ |
| order-service | auth-service | 3001 | ✅ |
| order-service | product-service | 3002 | ✅ |
| auth-service | mongodb-auth | 27017 | ✅ |
| product-service | mongodb-product | 27017 | ✅ |
| order-service | mongodb-order | 27017 | ✅ |
| auth-service | mongodb-product/order | 27017 | ❌ |
| product-service | mongodb-auth/order | 27017 | ❌ |
| Any | Any (default deny) | Any | ❌ |

---

## Global Values Reference

All subchart templates read from `.Values.global.*` injected by the umbrella chart:

| Key | Default | Description |
|-----|---------|-------------|
| `global.environment` | `dev` | Label applied to all resources |
| `global.imageRegistry` | `docker.io/myrepo` | Docker registry prefix |
| `global.namespaces.frontend` | `frontend` | Frontend workload namespace |
| `global.namespaces.backend` | `backend` | Backend service namespace |
| `global.namespaces.database` | `database` | MongoDB namespace |
| `global.namespaces.gateway` | `gateway` | Gateway namespace |
| `global.mongodb.username` | `admin` | MongoDB root username |
| `global.mongodb.password` | `secret` | MongoDB root password |
| `global.resources.limits.cpu` | `500m` | CPU limit for all services |
| `global.resources.limits.memory` | `512Mi` | Memory limit for all services |
| `global.jwtSecret` | `CHANGE_ME_...` | JWT signing secret |

---

## Local Development

```bash
# Start all services locally with Docker Compose
docker-compose up --build

# Services available at:
# Frontend:        http://localhost:3000
# Auth Service:    http://localhost:3001
# Product Service: http://localhost:3002
# Order Service:   http://localhost:8000
```

---

## Security Checklist

- [x] Default-Deny NetworkPolicies in all functional namespaces
- [x] Each MongoDB only accepts connections from its ownerApp service
- [x] Sensitive values (MONGO_URI, JWT_SECRET) stored in Kubernetes Secrets
- [x] Non-sensitive config stored in ConfigMaps
- [x] Image tags use commit SHA or semver for full traceability
- [x] Argo CD self-heal prevents manual cluster drift
- [ ] Replace `CHANGE_ME_JWT_SECRET` with a real 32+ char secret in values.yaml
- [ ] Replace `10.0.0.10` with your actual NFS server IP in k8s/01-nfs-storage.yaml
- [ ] Replace `docker.io/myrepo` with your Docker Hub org in values.yaml
- [ ] Use Sealed Secrets or External Secrets Operator for prod passwords
