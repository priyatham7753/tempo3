# ShopMesh

> Production-grade microservices e-commerce platform on Kubernetes.
> Deployed via umbrella Helm chart with **Envoy Kubernetes Gateway API** routing.

---

## Table of Contents

- [Architecture](#architecture)
- [Services](#services)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Local Development](#local-development-docker-compose)
- [Kubernetes Deployment](#kubernetes-deployment-helm)
- [Routing Table](#routing-table)
- [Configuration](#configuration-reference)
- [Gateway Modes](#switching-between-gateway-modes)
- [MongoDB Persistence](#mongodb-persistence)
- [Secrets](#secrets-management)
- [Useful Commands](#useful-commands)
- [Troubleshooting](#troubleshooting)

---

## Architecture

```
  User Traffic
      │
      ▼  :80
  ┌─────────────────────────────────────────┐
  │        Envoy Gateway (K8s Gateway API)  │
  └──────────┬──────────┬──────────┬────────┘
             │          │          │
          /auth    /products    /orders     /
             │          │          │         │
         ┌───┴──┐  ┌────┴─┐  ┌───┴──┐  ┌───┴────┐
         │ Auth │  │ Prod │  │ Ord  │  │Frontend│
         │ :3001│  │ :3002│  │ :3003│  │  :80   │
         └───┬──┘  └────┬─┘  └───┬──┘  └────────┘
             └──────────┴────────┘
                        │
              ┌─────────┴──────────┐
              │ MongoDB StatefulSet│
              │   (NFS PVC 10Gi)   │
              └────────────────────┘
```

---

## Services

| Service | Language | Port | Database | Role |
|---------|----------|------|----------|------|
| **auth-service** | Node.js | 3001 | authdb | JWT auth & user management |
| **product-service** | Node.js | 3002 | productdb | Product catalog CRUD |
| **order-service** | Python | 3003 | orderdb | Order management |
| **frontend** | React + Nginx | 80 | — | Single-page application |
| **mongodb** | mongo:7.0 | 27017 | — | Shared DB (StatefulSet) |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Container Runtime | Docker |
| Orchestration | Kubernetes ≥ 1.28 |
| Package Manager | Helm v3 |
| Ingress/Gateway | Kubernetes Gateway API + Envoy Gateway |
| Database | MongoDB 7.0 |
| Storage | NFS-backed PersistentVolume |
| Auth | JWT (jsonwebtoken) |
| Local Dev | Docker Compose |

---

## Project Structure

```
tempo3/
├── README.md
├── EXECUTE.txt                     # Step-by-step execution guide
├── docker-compose.yml              # Local dev stack
│
├── auth-service/                   # Node.js JWT service
├── product-service/                # Node.js product service
├── order-service/                  # Python order service
├── frontend/                       # React + Nginx SPA
│
├── k8s/                            # Raw kubectl manifests (legacy reference)
│   ├── namespace.yaml
│   ├── ingress.yaml                # Nginx Ingress (superseded by Helm gateway)
│   ├── mongodb/
│   ├── services/
│   ├── network/
│   └── storage/
│
└── helm-charts/                    # PRIMARY DEPLOYMENT METHOD
    ├── Chart.yaml                  # Umbrella chart
    ├── values.yaml                 # ONE global values file
    └── charts/
        ├── auth-service/           # Deployment, Service, ConfigMap, Secret
        ├── product-service/        # Deployment, Service, ConfigMap, Secret
        ├── order-service/          # Deployment, Service, ConfigMap, Secret
        ├── frontend/               # Deployment, Service, ConfigMap
        ├── mongodb/                # StatefulSet, Headless Svc, PVC, Secret
        └── gateway/                # GatewayClass, Gateway, HTTPRoute
```

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| `kubectl` | ≥ 1.28 | https://kubernetes.io/docs/tasks/tools/ |
| `helm` | ≥ 3.12 | https://helm.sh/docs/intro/install/ |
| `docker` | ≥ 24 | https://docs.docker.com/get-docker/ |
| Kubernetes cluster | ≥ 1.28 | minikube / kind / cloud cluster |
| NFS server | — | Required for MongoDB persistence |

---

## Local Development (Docker Compose)

```bash
# Start the full stack
docker compose up --build

# Access points
#   Frontend    → http://localhost:3000
#   Auth API    → http://localhost:3001
#   Product API → http://localhost:3002
#   Order API   → http://localhost:3003
#   MongoDB     → localhost:27017

# Stop
docker compose down

# Stop and remove volumes
docker compose down -v
```

---

## Kubernetes Deployment (Helm)

### Step 1 — Install Gateway API CRDs

```bash
kubectl apply -f \
  https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.1.0/standard-install.yaml

# Verify
kubectl get crd | grep gateway.networking.k8s.io
```

### Step 2 — Install Envoy Gateway Controller

```bash
helm install eg oci://docker.io/envoyproxy/gateway-helm \
  --version v1.1.0 \
  --namespace envoy-gateway-system \
  --create-namespace

# Wait for readiness
kubectl rollout status deployment/envoy-gateway \
  -n envoy-gateway-system --timeout=120s
```

### Step 3 — Configure NFS (values.yaml)

Edit `helm-charts/values.yaml` and update:
```yaml
mongodb:
  nfs:
    server: "YOUR_NFS_SERVER_IP"    # e.g. 192.168.1.100
    path: "/exports/mongodb"        # NFS export path
```

### Step 4 — Deploy ShopMesh

```bash
# Install
helm install shopmesh ./helm-charts \
  --namespace shopmesh \
  --create-namespace

# Upgrade (after config changes)
helm upgrade shopmesh ./helm-charts --namespace shopmesh

# Verify
kubectl get all -n shopmesh
kubectl get gateway,httproute -n shopmesh
```

---

## Routing Table

All external traffic enters through the Envoy Gateway on **port 80**.

| Path Prefix | Service | Port |
|-------------|---------|------|
| `/auth` | auth-service | 3001 |
| `/products` | product-service | 3002 |
| `/orders` | order-service | 3003 |
| `/` | frontend | 80 |

---

## Configuration Reference

All configuration is in one file: **`helm-charts/values.yaml`**

```yaml
global:
  namespace: shopmesh
  imagePullPolicy: Always
  gateway:
    enabled: true          # true = Envoy Gateway | false = Nginx Ingress

mongodb:
  storage:
    size: 10Gi
    storageClassName: nfs-storage
  nfs:
    server: "172.31.24.10"
    path: "/exports/mongodb"
```

Override at deploy time without editing values.yaml:
```bash
helm upgrade shopmesh ./helm-charts -n shopmesh \
  --set "auth-service.image.tag=v2.0.0" \
  --set "product-service.replicaCount=3" \
  --set "mongodb.nfs.server=192.168.1.100"
```

---

## Switching Between Gateway Modes

```bash
# Envoy Gateway API (default — recommended)
helm upgrade shopmesh ./helm-charts -n shopmesh \
  --set global.gateway.enabled=true

# Legacy Nginx Ingress (fallback)
helm upgrade shopmesh ./helm-charts -n shopmesh \
  --set global.gateway.enabled=false
```

When using legacy mode, routes change to: `/api/auth`, `/api/products`, `/api/orders`.

---

## MongoDB Persistence

```
StatefulSet: mongodb
  └── volumeClaimTemplate: mongodb-data
        └── PVC: mongodb-data-mongodb-0
              └── PV: mongodb-pv  (NFS-backed)
                    └── NFS Server:/exports/mongodb
```

**NFS server setup (run on NFS server):**
```bash
mkdir -p /exports/mongodb
chown -R nobody:nogroup /exports/mongodb
echo "/exports/mongodb *(rw,sync,no_subtree_check,no_root_squash)" >> /etc/exports
exportfs -ra
systemctl restart nfs-kernel-server
```

**NFS client setup (run on ALL Kubernetes nodes):**
```bash
apt install -y nfs-common
```

---

## Secrets Management

Secrets are base64-encoded in `helm-charts/values.yaml`.

```bash
# Encode a new secret
echo -n 'my-new-password' | base64

# Decode to verify
echo 'bXktbmV3LXBhc3N3b3Jk' | base64 --decode
```

**Default credentials (replace before production):**

| Secret | Default Value |
|--------|--------------|
| `JWT_SECRET` | `shopmesh_jwt_secret_change_in_production_2024` |
| `MONGO_ROOT_USERNAME` | `admin` |
| `MONGO_ROOT_PASSWORD` | `shopmesh-db-password-2024` |

---

## Useful Commands

```bash
# All ShopMesh resources
kubectl get all -n shopmesh

# Gateway resources
kubectl get gatewayclass,gateway,httproute -n shopmesh

# Logs
kubectl logs -l app.kubernetes.io/name=auth-service    -n shopmesh --tail=50
kubectl logs -l app.kubernetes.io/name=product-service -n shopmesh --tail=50
kubectl logs -l app.kubernetes.io/name=order-service   -n shopmesh --tail=50
kubectl logs -l app.kubernetes.io/name=mongodb         -n shopmesh --tail=50

# Shell into a pod
kubectl exec -it -n shopmesh \
  $(kubectl get pod -l app.kubernetes.io/name=auth-service -n shopmesh -o name | head -1) \
  -- sh

# Helm operations
helm status   shopmesh -n shopmesh
helm history  shopmesh -n shopmesh
helm template shopmesh ./helm-charts -n shopmesh   # dry-run preview
helm lint     ./helm-charts

# Uninstall
helm uninstall shopmesh -n shopmesh
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `no kind "GatewayClass"` | CRDs not installed | Re-run Step 1 |
| Gateway stays `Unknown` | Envoy controller not ready | Check `envoy-gateway-system` namespace |
| MongoDB pod `Pending` | NFS PV not bound | Verify NFS server IP and export path |
| `ImagePullBackOff` | Image not in registry | Push image or set `imagePullPolicy: IfNotPresent` |
| 502 Bad Gateway | Pod not ready yet | Check readiness probe with `kubectl describe pod` |
| `helm install` CRD error | Gateway API CRDs missing | Re-apply standard-install.yaml |

---

## Docker Hub Images

| Service | Image |
|---------|-------|
| auth-service | `priyatham753/auth-service:latest` |
| product-service | `priyatham753/product-service:latest` |
| order-service | `priyatham753/order-service:latest` |
| frontend | `priyatham753/frontend:latest` |
| mongodb | `mongo:7.0` |

---

*ShopMesh — Kubernetes-native microservices e-commerce platform.*
