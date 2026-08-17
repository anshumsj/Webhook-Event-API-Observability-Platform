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

### Frontend
- **Framework**: React initialized via Vite.
- **Routing**: React Router configured with a central `AppRoutes` file.
- **API Client**: Reusable Axios instance pre-configured to communicate with the backend (`src/services/api.js`).
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
