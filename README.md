# Webhook Event Observability Platform

This repository contains the monorepo structure for the Webhook Event Observability Platform. 
It is divided into a frontend (React/Vite) and backend (Node/Express).

## Project Structure

- `frontend/`: React application configured with Vite, React Router, and Axios.
- `backend/`: Node.js Express server with MongoDB integration.

## Features Implemented So Far

### Backend
- **Express Server**: Basic REST API setup with `dotenv` configuration.
- **Database**: MongoDB connection using Mongoose (`config/database.js`).
- **User Authentication**:
  - `POST /api/auth/register`: User registration with bcrypt password hashing.
  - `POST /api/auth/login`: User login generating a JSON Web Token (JWT).
  - `GET /api/auth/me`: Protected route returning the currently authenticated user's profile.
  - **Middleware**: Custom JWT verification middleware to protect private routes.
- **Workspaces & Projects**:
  - API routes to manage multi-tenant workspaces and projects.
- **Webhook Ingestion Engine**:
  - `WebhookEndpoint` model for securely generating endpoint IDs and signing secrets.
  - `WebhookEvent` model for persisting incoming webhook payloads, headers, and processing status.
  - `POST /api/webhooks/:endpointId`: Receiver API that validates the endpoint and securely records the event.
- **Events API (Project Scoped)**:
  - `GET /api/events/project/:projectId`: Fetch paginated events securely.
  - `GET /api/events/:eventId`: Fetch individual event details with sensitive header redaction.
  - Strict Authorization: Ensures `req.user` is a member of the Workspace owning the Project.
- **Observability & Tracing**:
  - Global request ID correlation middleware that generates or reads `X-Request-ID` headers to ensure distributed tracing capabilities when scaling out to queues and workers.

### Frontend
- **Framework & Styling**: React (Vite) + Tailwind CSS for a premium dark-themed UI.
- **Authentication Flow**: 
  - JWT integration via `AuthContext`.
  - Axios interceptors for global 401 Unauthorized handling & seamless token injection.
- **Dashboard Layout**: 
  - Dynamic `Sidebar` and `Navbar`.
  - `WorkspaceContext` handles auto-fetching and switching multi-tenant workspaces.
- **Projects & Webhooks UI**:
  - **Projects View**: Safely fetches and lists all projects in the active workspace.
  - **Events Dashboard**: Real-time paginated table displaying event ID, parsed Event Type, Status, Timestamp, and Processing Time.
  - **Event Details View**: Deep dive into individual webhooks. Displays safe JSON payload formatting, redacted headers list, rich metadata, and a visual processing timeline placeholder.
- **Architecture**: Folders scaffolded for `components`, `context`, `hooks`, `pages`, `routes`, and `services`.

## Getting Started

### Prerequisites
- Node.js installed on your machine.
- MongoDB running locally or a remote MongoDB URI.

### Setup Instructions
1. Run `npm install` in the root directory. This will automatically install dependencies for both the frontend and backend workspaces.
2. In the `backend/` directory, create a `.env` file with the following variables:
   ```env
   PORT=3001
   MONGODB_URI=mongodb://localhost:27017/webhook-observability
   JWT_SECRET=your_super_secret_jwt_key
   ```
3. Run `npm run dev` in the root directory. This will start both the React frontend and the Express backend development servers concurrently.
