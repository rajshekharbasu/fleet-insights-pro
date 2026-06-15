# Stage 1: Build the Vite application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the application code
COPY . .

# Set environment variable so the build uses production optimizations
ENV NODE_ENV=production

# Build the app (outputs to dist/)
RUN npm run build

# Stage 2: Serve the application using Node.js
FROM node:20-alpine

WORKDIR /app

# Copy the built output and necessary files from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/vite.config.ts ./vite.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

COPY --from=builder /app/src ./src

# TanStack Start preview plugin expects server.js, but Lovable outputs index.js
RUN cp /app/dist/server/index.js /app/dist/server/server.js

# Expose the port used by vite preview (default 4173)
EXPOSE 4173

# Start the application using Vite preview, binding to all interfaces
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0"]
