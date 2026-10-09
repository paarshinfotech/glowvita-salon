# Dockerfile for crm app
# FROM node:20-bullseye AS base
FROM node:20-bookworm AS base

WORKDIR /app

# Install turbo
RUN npm install -g turbo

# Prune dependencies
FROM base AS pruner
WORKDIR /app

COPY . .
RUN turbo prune --scope=crm --docker

# Builder
FROM base AS builder
WORKDIR /app

# Copy pruned package.json files and lockfile
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/package-lock.json .

# Install dependencies
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN npm install --frozen-lockfile
RUN npx playwright install --with-deps chromium

# Copy pruned source code
COPY --from=pruner /app/out/full/ .
COPY turbo.json .

# Build the app

ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

ARG NEXT_PUBLIC_FIREBASE_API_KEY
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY

ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID

ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID

ARG NEXT_PUBLIC_FIREBASE_APP_ID
ENV NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID

ARG NEXT_PUBLIC_FIREBASE_VAPID_KEY
ENV NEXT_PUBLIC_FIREBASE_VAPID_KEY=$NEXT_PUBLIC_FIREBASE_VAPID_KEY

ARG NEXT_PUBLIC_CRM_URL
ENV NEXT_PUBLIC_CRM_URL=$NEXT_PUBLIC_CRM_URL

ARG NEXT_PUBLIC_WEB_URL
ENV NEXT_PUBLIC_WEB_URL=$NEXT_PUBLIC_WEB_URL

ARG NEXT_PUBLIC_ADMIN_URL
ENV NEXT_PUBLIC_ADMIN_URL=$NEXT_PUBLIC_ADMIN_URL

ARG NEXT_PUBLIC_RAZORPAY_KEY_ID
ENV NEXT_PUBLIC_RAZORPAY_KEY_ID=$NEXT_PUBLIC_RAZORPAY_KEY_ID

RUN turbo run build --filter=crm

# Runner
FROM node:20-bullseye AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001

# 👇 ADD THIS
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/apps/crm/.next/standalone ./
# 👇 ADD THIS
COPY --from=builder /ms-playwright /ms-playwright
# Copy static assets
COPY --from=builder --chown=nextjs:nodejs /app/apps/crm/.next/static ./apps/crm/.next/static
# Copy public folder (IMPORTANT)
COPY --from=builder --chown=nextjs:nodejs /app/apps/crm/public ./apps/crm/public

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libnss3 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libasound2 \
    fonts-liberation \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

USER nextjs

EXPOSE 3001

CMD ["node", "apps/crm/server.js"]