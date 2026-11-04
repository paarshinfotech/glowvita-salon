
#!/bin/bash
set -e

echo "[INFO] Starting GlowVitaSalon deployment..."

echo "[INFO] Checking Git working tree..."
if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "[ERROR] Local changes detected. Commit or discard them first."
    exit 1
fi

echo "[INFO] Fetching latest code..."
git fetch origin main

echo "[INFO] Pulling latest code..."
git pull --ff-only origin main

echo "[INFO] Building and deploying Docker containers..."
docker compose -f docker-compose.prod.yml up -d --build

echo "[INFO] Removing unused Docker images..."
docker image prune -f

echo "[SUCCESS] GlowVitaSalon deployment completed!"
