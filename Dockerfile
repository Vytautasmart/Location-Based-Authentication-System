# Stage 1: Build frontend
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Production
FROM node:22-alpine
WORKDIR /app

# Install backend dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy backend source
COPY app.js generate-cert.js ./
COPY bin/ ./bin/
COPY db/postgre.js ./db/
COPY middleware/ ./middleware/
COPY routes/ ./routes/
COPY services/ ./services/

# Copy built frontend from stage 1
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Generate self-signed SSL certificates
RUN node generate-cert.js

# Expose HTTPS and HTTP redirect ports
EXPOSE 3443 3000

# Start the server
CMD ["node", "./bin/www"]
