# Webhook Event Observability Platform

This repository contains the monorepo structure for the Webhook Event Observability Platform. 
It is divided into a frontend (React/Vite) and backend (Node/Express/Worker).

## Architecture

The platform uses an asynchronous, highly-scalable architecture:
1. **API Server (Express)**: Ingests webhooks, validates them, saves them to MongoDB, and pushes a job to Redis. Returns `202 Accepted` immediately.
2. **Queue (Redis + BullMQ)**: Buffers incoming webhook events to seamlessly handle massive traffic spikes.
3. **Worker**: A separate process that consumes jobs from the queue, processes the webhooks, and updates MongoDB. Supports retries, exponential backoff, and concurrent processing.
4. **Real-time Engine (Socket.IO)**: Broadcasts lifecycle state changes (`received` → `queued` → `processing` → `processed`/`failed`) directly to the frontend.

## Features

### Backend
- **Express Server**: REST API setup with `dotenv` configuration.
- **Database**: MongoDB connection using Mongoose.
- **Asynchronous Queue**: Redis and BullMQ for reliable, scalable webhook processing.
- **Standalone Worker**: Processes webhooks asynchronously.
- **Real-time WebSockets**: Socket.IO integration for live UI updates.
- **User Authentication**:
  - `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`.
  - Custom JWT verification middleware.
- **Workspaces & Projects**: Multi-tenant isolation.
- **Webhook Ingestion Engine**:
  - `WebhookEndpoint` model for securely generating endpoint IDs.
  - `WebhookEvent` model with a full 5-state lifecycle (`received`, `queued`, `processing`, `processed`, `failed`).
  - `POST /api/webhooks/:endpointId`: Receiver API returning immediate `202 Accepted`.
- **Events API (Project Scoped)**:
  - Securely fetch paginated events and individual event details with sensitive header redaction.
- **Observability & Tracing**: Global `X-Request-ID` correlation middleware for distributed tracing across API, Queue, and Worker.

### Frontend
- **Framework & Styling**: React (Vite) + Tailwind CSS for a premium dark-themed UI.
- **Authentication Flow**: JWT integration via `AuthContext` and Axios interceptors.
- **Dashboard Layout**: Dynamic `Sidebar`, `Navbar`, and `WorkspaceContext` for multi-tenant switching.
- **Projects & Webhooks UI**:
  - **Events Dashboard**: Real-time paginated table displaying event ID, parsed Event Type, Status, Timestamp, and Processing Time.
  - **Event Details View**: Deep dive into individual webhooks. Displays safe JSON payload formatting, redacted headers list, rich metadata, and a live visual processing lifecycle timeline.
  - **Live Updates**: The UI responds in real-time to Socket.IO events, updating statuses, badges, and the lifecycle timeline instantly without page refreshes.

## Getting Started

### Prerequisites
- Node.js installed on your machine.
- MongoDB running locally or a remote MongoDB URI.
- Redis server running locally or a remote Redis URI.

## Docker / Production-like Local Setup

To run HookSight in a fully containerized, production-like environment locally using Docker Compose:

1. Ensure Docker and Docker Compose are installed.
2. The environment variables are safely defaulted for local Compose execution.
3. Build and start the containers in detached mode:
   ```bash
   docker compose build
   docker compose up -d
   ```
4. Verify the containers are running and healthy:
   ```bash
   docker compose ps
   ```
5. View logs for any service (e.g., backend):
   ```bash
   docker compose logs -f backend
   ```
6. Access the frontend in your browser:
   **http://localhost:8080**
7. Stop the containers:
   ```bash
   docker compose down
   ```

## Development Setup Instructions
1. Run `npm install` in the root directory. This will automatically install dependencies for both the frontend and backend workspaces.
2. Create your `.env` files from the provided examples:
   - In the `backend/` directory, copy `.env.example` to `.env` and fill in your values (like `MONGODB_URI` and `JWT_SECRET`).
   - In the `frontend/` directory, copy `.env.example` to `.env` if you need to override `VITE_API_BASE_URL`.
3. Run `npm run dev` in the root directory. This will start the React frontend, the Express backend API, and the BullMQ Worker concurrently.
