# Build stage
FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN yarn build

# Production stage
FROM node:24-alpine

WORKDIR /app

# Install system dependencies (wget for healthcheck, bash for script execution)
RUN apk add --no-cache wget bash

# Copy package files for production dependencies
COPY package.json yarn.lock ./

# Install only production dependencies
RUN yarn install --production --frozen-lockfile

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server

# Create directory for scripts
RUN mkdir -p /app/scripts

# Set environment to production
ENV NODE_ENV=production

# Expose port (только backend в production)
EXPOSE 5005

# Start the application
CMD ["yarn", "start"]
