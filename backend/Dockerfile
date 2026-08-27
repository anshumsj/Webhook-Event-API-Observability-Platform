# Use Node.js LTS Alpine
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy root manifests
COPY package.json package-lock.json ./

# Copy workspace package.json files
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Install production dependencies for backend only
RUN npm ci --workspace=backend --omit=dev

# Copy backend source code
COPY backend/ ./backend/

# Set working directory to backend
WORKDIR /app/backend

# Expose port
EXPOSE 3001

# Start the server
CMD ["node", "server.js"]
