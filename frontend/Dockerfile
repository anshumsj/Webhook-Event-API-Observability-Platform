# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root manifests
COPY package.json package-lock.json ./

# Copy workspace package.json files
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Install dependencies
RUN npm ci

# Copy frontend source code
COPY frontend/ ./frontend/

# Build the frontend using Vite
# VITE_API_BASE_URL will be provided as a build argument
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

WORKDIR /app/frontend
RUN npm run build

# Stage 2: Runtime
FROM nginx:alpine

# Copy the generated Vite dist directory into Nginx's static web root
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Run Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]
