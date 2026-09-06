# HookSight — Developer Webhook Observability & Diagnostics Platform

HookSight is a developer-first, production-ready observability and diagnostic platform for incoming webhooks. It decouples high-throughput HTTP ingestion from asynchronous delivery, captures granular execution telemetry across every delivery attempt, provides real-time lifecycle monitoring, and offers developer-grade replay, filtering, and debugging capabilities.

---

## Architecture Overview

HookSight employs an asynchronous, event-driven queue-and-worker architecture designed to withstand high-volume bursts without dropping inbound events.

```
                  ┌────────────────────────────────────────────────────────┐
                  │                    Inbound Webhook                     │
                  └──────────────────────────┬─────────────────────────────┘
                                             │ HTTP POST /api/webhooks/:endpointId
                                             ▼
                             ┌───────────────────────────────┐
                             │       HookSight API Server     │
                             │ (Validation & Auth Middleware)│
                             └───────┬───────────────┬───────┘
                                     │               │
     1. Persist Event (status: pending)              │ 2. Enqueue Job
                                     ▼               ▼
                       ┌──────────────────┐    ┌──────────────────┐
                       │  MongoDB Cluster │    │  BullMQ / Redis  │
                       └──────────────────┘    └────────┬─────────┘
                                                        │
                                                        ▼
                                       ┌────────────────────────────────┐
                                       │    Asynchronous Worker Pool    │
                                       │   (Concurrency: 5 per worker)  │
                                       └────────┬───────────────┬───────┘
                                                │               │
                   3. Outbound SSRF-Protected   │               │ 4. Real-time Status
                      Delivery to Destination   │               │    Broadcast via WebSocket
                                                ▼               ▼
                                       ┌────────────────┐ ┌──────────────┐
                                       │ Target Webhook │ │  Socket.IO   │
                                       │   Destination  │ │ Room:project │
                                       └────────────────┘ └──────┬───────┘
                                                                 │
                                                                 ▼
                                                        ┌────────────────┐
                                                        │ HookSight Web  │
                                                        │ UI (React 19)  │
                                                        └────────────────┘
```

### Core Architecture Components

1. **API Ingestion Server (Node.js & Express)**:
   - Validates endpoint and associated project integrity.
   - Enforces 500 KB payload bounds and verifies valid JSON structure.
   - Assigns a correlation `X-Request-ID` across every transaction.
   - Atomically records initial `WebhookEvent` document in MongoDB with state `pending`.
   - Dispatches a delivery job into Redis via BullMQ and immediately responds with `202 Accepted` (< 15ms response).

2. **Asynchronous Buffer Queue (BullMQ & Redis)**:
   - Buffers incoming delivery tasks to protect against destination timeouts and traffic spikes.
   - Provides configurable exponential backoff retry schedules (up to 3 automatic attempts).

3. **Background Delivery Worker (`webhookWorker.js`)**:
   - Consumes jobs from the Redis queue with controlled concurrency (`concurrency: 5`).
   - Executes DNS resolution and strict SSRF validations against destination URLs before every request.
   - Signs outbound requests with cryptographic HMAC SHA-256 signatures (`X-HookSight-Signature`).
   - Records comprehensive `DeliveryAttempt` logs (request/response headers, bodies, latency, and HTTP status codes).
   - Manages state transitions: `pending` → `processing` → `processed` (2xx response) or `retrying` / `retry_exhausted`.

4. **Real-Time Event Stream (Socket.IO)**:
   - Emits project-isolated WebSocket events (`webhook:event:updated`).
   - Synchronizes browser dashboards in real-time without polling or manual refreshes.

---

## Key Capabilities

- **High-Throughput Ingestion**: Immediate `202 Accepted` response with asynchronous delivery processing.
- **Complete 5-State Lifecycle Tracking**: `pending` → `processing` → `processed`, `retrying`, or `retry_exhausted`.
- **Granular Attempt Timelines**: Per-attempt latency (ms), HTTP request/response headers, raw response bodies, and error stacks.
- **Manual & Automatic Replay Engine**: Replay failed or processed webhooks with duplicate-key race protection and incrementing attempt sequences.
- **Historical Observability Retention**: Deleting a webhook endpoint preserves all historical events and delivery attempts; analytics continue accounting for past telemetry.
- **Project & Workspace Analytics**: Real-time delivery trends (24h hourly and 7d daily bucketing), success ratios, failure counts, retry rates, and p50/p90/p99 latency metrics.
- **Endpoint Health Categorization**: Automatic classification of endpoints into `healthy`, `degraded`, or `unhealthy` based on rolling 24-hour error and latency profiles.
- **Enterprise-Grade Security**:
  - **SSRF Defense**: Strict URL validation, protocol restrictions (HTTP/HTTPS only), private CIDR filtering, cloud metadata blocking (`169.254.169.254`), and DNS rebinding prevention via `safeLookup`.
  - **HMAC Signatures**: SHA-256 cryptographic payload signatures using endpoint secrets.
  - **Sensitive Header Redaction**: Automatic masking of `authorization`, `cookie`, `x-api-key`, and signature headers (`[REDACTED]`).
  - **Tiered Rate Limiting**: Redis-backed rate limiters on ingestion (300/min), replay (50/15min), auth (20/15min), registration (3/hr), and API keys (5/hr).
  - **JWT & Scoped API Keys**: Multi-tenant workspace isolation with bcrypt-hashed API keys (`hk_test_...`).

---

## Tech Stack

| Layer | Technologies |
|:---|:---|
| **Frontend** | React 19, Vite, Tailwind CSS, Lucide Icons, Date-fns, Axios, Socket.IO Client |
| **Backend** | Node.js (v20+), Express 4, Mongoose 9, BullMQ 6, ioredis 6, Socket.IO 4 |
| **Datastores** | MongoDB 6.0+ (Primary Data), Redis 7.0+ (Queue & Distributed Rate Limiting) |
| **Security** | Helmet, bcryptjs, ipaddr.js, express-rate-limit, rate-limit-redis, crypto (HMAC SHA-256) |
| **Containerization** | Docker, Docker Compose, Nginx (Alpine-based multi-stage production builds) |

---

## Repository Structure

```text
├── .gitignore
├── README.md                      # Primary project documentation
├── docker-compose.yml             # Full-stack Docker orchestration
├── openapi.yaml                   # OpenAPI / Swagger specification
├── package.json                   # Root workspace orchestration
│
├── backend/
│   ├── Dockerfile
│   ├── .env.example               # Backend environment template
│   ├── package.json
│   ├── server.js                  # Main API server & Socket.IO server
│   ├── worker.js                  # Standalone worker process entry point
│   ├── run-all-tests.js           # Consolidated test runner
│   │
│   ├── benchmarks/                # Performance and stress benchmarks
│   │   ├── db-indexes-and-cache.benchmark.js
│   │   └── rate-limiting.benchmark.js
│   │
│   ├── config/                    # MongoDB and Redis singleton configurations
│   ├── controllers/               # API route controllers
│   ├── middleware/                # Auth, Rate Limiting, ObjectId validation, Request ID
│   ├── models/                    # Mongoose schemas (User, Workspace, Project, WebhookEndpoint, WebhookEvent, DeliveryAttempt, ApiKey)
│   ├── queue/                     # BullMQ Queue and Worker implementation
│   ├── routes/                    # Express REST route definitions
│   ├── scripts/                   # Developer utilities (mock server, redis diagnostic)
│   ├── services/                  # Business logic (delivery, auth, project, workspace)
│   ├── tests/                     # 6 Consolidated regression test suites
│   │   ├── 1. ingestion.test.js
│   │   ├── 2. lifecycle-and-deletion.test.js
│   │   ├── 3. analytics-and-trends.test.js
│   │   ├── 4. events-filtering.test.js
│   │   ├── 5. security.test.js
│   │   └── 6. flow.test.js
│   └── utils/                     # Redaction, SSRF validator, error wrappers
│
└── frontend/
    ├── Dockerfile
    ├── nginx.conf                 # Production SPA router configuration
    ├── .env.example               # Frontend environment template
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx
        ├── components/            # UI components, layout, charts, timelines
        ├── context/               # Auth, Workspace, and Socket.IO providers
        ├── pages/                 # Home, Login, Projects, Endpoints, Events, EventDetails, Settings
        ├── routes/                # Client-side routing with protected route wrapper
        ├── services/              # Axios API client with token interceptor
        └── utils/                 # Standardized error unwrapping & formatting
```

---

## Getting Started

### Prerequisites

- **Node.js**: v20.x or later
- **Docker & Docker Compose** (for containerized execution)
- **MongoDB**: v6.0+ (if running natively)
- **Redis**: v7.0+ (if running natively)

---

### Option A: Running via Docker Compose (Recommended)

Docker Compose starts the entire ecosystem (MongoDB, Redis, Backend API, and Frontend) with health checks pre-configured.

1. **Clone the repository**:
   ```bash
   git clone https://github.com/anshumsj/Webhook-Event-API-Observability-Platform.git
   cd Webhook-Event-API-Observability-Platform
   ```

2. **Build and start services**:
   ```bash
   docker compose up -d --build
   ```

3. **Verify container health**:
   ```bash
   docker compose ps
   ```
   *Expected output:*
   - `hooksight_mongodb` (Port `27018:27017` on host) — Healthy
   - `hooksight_redis` (Port `6380:6379` on host) — Healthy
   - `hooksight_backend` (Port `3001:3001`) — Healthy
   - `hooksight_frontend` (Port `8080:80`) — Running

4. **Access the Application**:
   - Web Console: [http://localhost:8080](http://localhost:8080)
   - Backend API Health: [http://localhost:3001/api/health](http://localhost:3001/api/health)

5. **Stop containers**:
   ```bash
   docker compose down
   ```

---

### Option B: Native Local Development

1. **Install dependencies across all workspaces**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   - Backend:
     ```bash
     cp backend/.env.example backend/.env
     ```
     *(Review `backend/.env` to ensure `MONGODB_URI`, `REDIS_URL`, and `JWT_SECRET` are populated).*
   - Frontend:
     ```bash
     cp frontend/.env.example frontend/.env
     ```

3. **Start MongoDB and Redis** locally or point to remote instances.

4. **Start development servers**:
   ```bash
   npm run dev
   ```
   *This starts the Express API server, BullMQ worker, and Vite dev server (`http://localhost:5173`).*

---

## Environment Configuration

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|:---|:---:|:---|:---|
| `PORT` | No | `3001` | Port for the Express REST and Socket.IO server. |
| `NODE_ENV` | No | `development` | Runtime environment (`development`, `production`, `test`). |
| `MONGODB_URI` | **Yes** | `mongodb://127.0.0.1:27017/webhookObservability` | Primary MongoDB database connection string. |
| `TEST_MONGODB_URI` | No | `mongodb://127.0.0.1:27018/webhookObservability` | MongoDB URI used by the test runner (`run-all-tests.js`). |
| `REDIS_URL` | **Yes** | `redis://127.0.0.1:6379` | Redis connection URL for BullMQ queue and rate-limiting. |
| `JWT_SECRET` | **Yes** | — | Cryptographic secret for signing tokens. Server fails closed if omitted. |
| `ALLOWED_ORIGINS` | No | `http://localhost:5173,http://localhost:8080` | Comma-separated list of permitted CORS origins. |

### Frontend (`frontend/.env`)

| Variable | Required | Default | Description |
|:---|:---:|:---|:---|
| `VITE_API_BASE_URL` | No | `http://localhost:3001/api` | API base URL. Socket.IO automatically derives its host origin from this. |

---

## Verification & Testing

HookSight includes a consolidated regression test suite that validates every layer of the platform without external testing dependencies.

### Running the Consolidated Regression Suite

```bash
npm test
```
*(Runs all 6 suites sequentially against the local/Docker datastores in ~8 seconds)*:

1. **Ingestion Reliability (`ingestion.test.js`)**: Validates 202 acceptance, empty/malformed/oversized JSON rejection (400/413), missing endpoint/project checks (404), header sanitization, and duplicate delivery decoupling.
2. **Lifecycle, Deletion & Hardening (`lifecycle-and-deletion.test.js`)**: Validates non-cascading endpoint deletion, preservation of historical events and delivery attempts, project-level analytics retention with 0 active endpoints, and replay rejection on deleted endpoints.
3. **Analytics, Delivery Trends & Health (`analytics-and-trends.test.js`)**: Validates 24h/7d analytics windows, hourly/daily bucketing, endpoint health classification, and operational `/api/health` dependency reporting.
4. **Events Filtering & Sorting (`events-filtering.test.js`)**: Validates filtering by status, endpoint, event type, time range, search text, compound filters, sorting (asc/desc), and pagination.
5. **Security, SSRF & Redaction (`security.test.js`)**: Validates SSRF prevention rules, endpoint secret omission, sensitive header redaction (`[REDACTED]`), cryptographic HMAC signatures, fail-closed JWT enforcement, and API key input validation.
6. **End-to-End Flow (`flow.test.js`)**: Executes complete user onboarding, workspace creation, project provisioning, endpoint setup, multi-provider webhook ingestion (GitHub, Stripe, custom), and cross-tenant isolation enforcement.

### Running Benchmarks & Developer Tooling

```bash
# Verify MongoDB compound index coverage and query performance (completes in ~5ms)
npm run benchmark:db

# Run rate-limiting burst benchmarks (verifies 300 req/min limits)
npm run benchmark:rate-limit

# Diagnose Redis connection and protocol latency
npm run diagnose:redis

# Run the configurable mock webhook destination server
npm run mock-server
```

### Running Linting & Production Build

```bash
# Run frontend linter (oxlint)
npm run lint

# Compile production bundle (Vite)
npm run build
```

---

## Major API Reference

All protected endpoints require either `Authorization: Bearer <jwt>` or an API Key (`Authorization: Bearer hk_test_...`).

### Authentication & Workspaces
| Method | Endpoint | Access | Description |
|:---|:---|:---|:---|
| `POST` | `/api/auth/register` | Public | Register new user. Rate limited (3/hr). |
| `POST` | `/api/auth/login` | Public | Authenticate user & retrieve JWT. Rate limited (20/15m). |
| `GET` | `/api/auth/me` | Private | Get profile for currently authenticated user. |
| `POST` | `/api/auth/api-keys` | Private | Generate workspace-scoped API key. Rate limited (5/hr). |
| `GET` | `/api/auth/api-keys` | Private | List active API keys for user. |
| `DELETE` | `/api/auth/api-keys/:id` | Private | Revoke an API key. |
| `POST` | `/api/workspaces` | Private | Create a new multi-tenant workspace. |
| `GET` | `/api/workspaces` | Private | List accessible workspaces for user. |

### Webhook Ingestion & Execution
| Method | Endpoint | Access | Description |
|:---|:---|:---|:---|
| `POST` | `/api/webhooks/:endpointId` | Public | Primary ingestion endpoint. Validates payload, enqueues job, returns `202 Accepted`. Rate limited (300/min). |
| `GET` | `/api/events/project/:projectId` | Private | Fetch paginated events with status, endpoint, type, and search filters. |
| `GET` | `/api/events/project/:projectId/types` | Private | List distinct event types discovered for a project. |
| `GET` | `/api/events/:eventId` | Private | Retrieve detailed event metadata, payload, redacted headers, and delivery attempts. |
| `POST` | `/api/events/:eventId/replay` | Private | Re-queue delivery attempt for a terminal event. Rate limited (50/15m). |

### Endpoints & Projects
| Method | Endpoint | Access | Description |
|:---|:---|:---|:---|
| `POST` | `/api/projects` | Private | Create a project within an authorized workspace. |
| `GET` | `/api/projects/:workspaceId` | Private | List projects within a workspace. |
| `POST` | `/api/endpoints/project/:projectId` | Private | Provision a webhook endpoint (auto-generates signing secret). |
| `GET` | `/api/endpoints/project/:projectId` | Private | List active endpoints (signing secrets omitted). |
| `PATCH` | `/api/endpoints/:endpointId` | Private | Update destination URL (enforces SSRF validations). |
| `DELETE` | `/api/endpoints/:endpointId` | Private | Delete endpoint (retains historical telemetry). |

### Analytics & System Health
| Method | Endpoint | Access | Description |
|:---|:---|:---|:---|
| `GET` | `/api/analytics/project/:projectId` | Private | Aggregated project metrics (success rate, retry rate, latency percentiles). |
| `GET` | `/api/analytics/project/:projectId/endpoints` | Private | Health status of active endpoints (`healthy`, `degraded`, `unhealthy`). |
| `GET` | `/api/analytics/workspace/:workspaceId` | Private | Aggregated metrics across all projects in a workspace. |
| `GET` | `/api/analytics/workspace/:workspaceId/trends` | Private | Time-series delivery trends with zero-filled time buckets. |
| `GET` | `/api/health` | Public | System and dependency operational health check. |

---

## Standardized Error Response Contract

All API errors return consistent JSON formatting with correlation tracking:

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Webhook payload is required and must be non-empty JSON",
    "requestId": "req_f82a7bc910"
  }
}
```

Common error codes:
- `BAD_REQUEST` (400) — Validation failure or malformed input.
- `UNAUTHORIZED` (401) — Missing, invalid, or expired authentication token.
- `FORBIDDEN` (403) — Insufficient workspace permissions or cross-tenant access attempt.
- `NOT_FOUND` (404) — Requested resource or endpoint does not exist.
- `PAYLOAD_TOO_LARGE` (413) — Inbound payload exceeds 500 KB limit.
- `RATE_LIMITED` (429) — Rate limit threshold exceeded.
- `INTERNAL_SERVER_ERROR` (500) — Unhandled server-side failure.

---

## Security Architecture

1. **SSRF & DNS Rebinding Defense**:
   - Outbound webhook delivery destination URLs are strictly validated at creation and during delivery.
   - Restricts protocols exclusively to `http:` and `https:`.
   - Resolves hostnames through custom DNS lookups and checks resolved IPs using `ipaddr.js`.
   - Blocks private IP spaces (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), loopbacks (`127.0.0.0/8`, `::1`), carrier-grade NATs, and cloud instance metadata services (`169.254.169.254`).

2. **Cryptographic Webhook Signatures**:
   - Outgoing deliveries include an `X-HookSight-Signature: sha256=<signature>` header computed via HMAC SHA-256 with the endpoint's unique secret.

3. **Sensitive Header Redaction**:
   - Sensitive headers (`authorization`, `cookie`, `x-api-key`, `stripe-signature`, `x-hub-signature`) are intercepted and replaced with `[REDACTED]` prior to persistence and display.

4. **Multi-Tenant Isolation**:
   - Every read and write operation validates the user's workspace membership.
   - API keys are cryptographically hashed using bcrypt with salt rounds and scoped to a single workspace.

5. **Fail-Closed Security**:
   - The backend server exits immediately on startup if `JWT_SECRET` is unset, preventing insecure defaults.

---

## License

This project is licensed under the MIT License.
