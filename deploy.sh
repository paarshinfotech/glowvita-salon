
#!/bin/bash

set -e

echo "[INFO] Starting GlowVitaSalon deployment..."

# Navigate to project directory automatically
cd "$(dirname "$0")"

echo "[INFO] Fetching latest code from GitHub..."

git fetch origin main

echo "[INFO] Pulling latest code..."

git pull --ff-only origin main

echo "[INFO] Stopping existing containers..."

docker-compose -f docker-compose.prod.yml down

echo "[INFO] Building Docker images..."

docker-compose -f docker-compose.prod.yml build

echo "[INFO] Starting containers..."

docker-compose -f docker-compose.prod.yml up -d

echo "[INFO] Checking container status..."

docker-compose -f docker-compose.prod.yml ps

echo "[SUCCESS] GlowVitaSalon deployment completed!"
