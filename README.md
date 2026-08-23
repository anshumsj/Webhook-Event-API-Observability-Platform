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

### Setup Instructions
1. Run `npm install` in the root directory. This will automatically install dependencies for both the frontend and backend workspaces.
2. In the `backend/` directory, create a `.env` file with the following variables:
   ```env
   PORT=3001
   MONGODB_URI=mongodb://localhost:27017/webhook-observability
   REDIS_HOST=localhost
   REDIS_PORT=6379
   JWT_SECRET=your_super_secret_jwt_key
   ```
3. Run `npm run dev` in the root directory. This will start the React frontend, the Express backend API, and the BullMQ Worker concurrently.
