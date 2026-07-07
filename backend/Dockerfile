# Base image
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy dependency manifests
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies (including devDependencies for build)
RUN npm ci

# Copy the rest of the application files
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the NestJS application
RUN npm run build

# Prune devDependencies
RUN npm prune --production


# Production image stage
FROM node:20-alpine

WORKDIR /app

# Copy production artifacts and node_modules from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Expose port (NestJS runs on PORT env var or defaults to 3001)
EXPOSE 3001

# Command to run the application
CMD ["node", "dist/main"]
