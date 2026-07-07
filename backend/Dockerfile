# Base image using Debian Slim (more robust for Prisma/OpenSSL compatibility)
FROM node:20-slim AS builder

# Install openssl for Prisma compatibility
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy dependency manifests
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy the rest of the application files
COPY . .

# Generate Prisma Client (uses dummy URL during build time)
RUN DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy npx prisma generate

# Build the NestJS application
RUN npm run build

# Prune devDependencies
RUN npm prune --production


# Production image stage
FROM node:20-slim

# Install openssl in production image too
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy production artifacts and node_modules from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.js ./

# Expose port (NestJS runs on PORT env var or defaults to 3001)
EXPOSE 3001

# Command to run the application
CMD ["node", "dist/main"]
