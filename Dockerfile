# Stage 1: Base
FROM node:20-alpine AS base
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

# Stage 2: Dependencies
FROM base AS deps
COPY package.json ./
# We just use install. It's safer if your lockfile is missing or out of sync.
RUN npm install

# Stage 3: Build & Generate
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npx tsc

# Stage 4: Runner (The "Size Saver" Stage)
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production

# Copy only production dependencies
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts && npm cache clean --force

# Copy generated prisma client and built code from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/dist ./dist

# THE MOST IMPORTANT LINE for 1.3GB -> 200MB:
# Remove Prisma engine binaries that aren't needed for runtime
RUN rm -rf node_modules/@prisma/engines

EXPOSE 3001
CMD ["node", "dist/index.js"]