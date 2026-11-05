#!/bin/bash

set -Eeuo pipefail

PROJECT_DIR="/home/glowvita/glowvita_salon"
NGINX_CONF="/etc/nginx/sites-enabled/glowvita.conf"

cd "$PROJECT_DIR"

echo "========================================"
echo "   GlowVitaSalon Blue-Green Deployment"
echo "========================================"

# 1. Verify Git working tree
if [ "$(git branch --show-current)" != "main" ]; then
    echo "[ERROR] Deployment must run from main branch."
    exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
    echo "[ERROR] Uncommitted changes found."
    echo "Commit and push your changes before deployment."
    git status --short
    exit 1
fi

# 2. Get latest code
echo "[INFO] Fetching latest code..."
git fetch origin main
git pull --ff-only origin main

# 3. Detect currently live environment
if grep -q "127.0.0.1:3100" "$NGINX_CONF"; then
    ACTIVE="GREEN"
    TARGET="BLUE"

    OLD_WEB=3100
    OLD_CRM=3101
    OLD_ADMIN=3102

    NEW_WEB=3000
    NEW_CRM=3001
    NEW_ADMIN=3002

    COMPOSE=(docker compose -p glowvita_salon -f docker-compose.prod.yml)

elif grep -q "127.0.0.1:3000" "$NGINX_CONF"; then
    ACTIVE="BLUE"
    TARGET="GREEN"

    OLD_WEB=3000
    OLD_CRM=3001
    OLD_ADMIN=3002

    NEW_WEB=3100
    NEW_CRM=3101
    NEW_ADMIN=3102

    COMPOSE=(docker compose -p glowvita-green -f docker-compose.green.yml)

else
    echo "[ERROR] Cannot identify active environment."
    exit 1
fi

echo "[INFO] Current LIVE environment: $ACTIVE"
echo "[INFO] Preparing environment: $TARGET"

# Verify that all three Nginx routes point to the same environment
for port in "$OLD_WEB" "$OLD_CRM" "$OLD_ADMIN"; do
    if ! grep -q "127.0.0.1:$port" "$NGINX_CONF"; then
        echo "[ERROR] Nginx configuration is inconsistent."
        exit 1
    fi
done

# 4. Validate target Compose configuration
if [ "$TARGET" = "BLUE" ]; then
    docker compose -p glowvita_salon -f docker-compose.prod.yml config --quiet
else
    docker compose -p glowvita-green -f docker-compose.green.yml config --quiet
fi

# 5. Build inactive environment
echo "[INFO] Building $TARGET images..."
"${COMPOSE[@]}" build

# 6. Start inactive environment only
echo "[INFO] Starting $TARGET containers..."
"${COMPOSE[@]}" up -d

# 7. Wait for application health checks
check_port() {
    local port="$1"
    local name="$2"
    local attempt
    local code

    echo "[INFO] Checking $name on port $port..."

    for attempt in $(seq 1 60); do
        code=$(curl -sS -o /dev/null \
            --connect-timeout 3 \
            --max-time 8 \
            -w '%{http_code}' \
            "http://127.0.0.1:$port/" 2>/dev/null || true)

        if [[ "$code" =~ ^[23][0-9][0-9]$ ]]; then
            echo "[OK] $name responded with HTTP $code"
            return 0
        fi

        sleep 5
    done

    echo "[ERROR] $name failed health check."
    return 1
}

if ! check_port "$NEW_WEB" "Website"; then
    echo "[ERROR] Deployment cancelled. $ACTIVE remains live."
    exit 1
fi

if ! check_port "$NEW_CRM" "CRM"; then
    echo "[ERROR] Deployment cancelled. $ACTIVE remains live."
    exit 1
fi

if ! check_port "$NEW_ADMIN" "Admin"; then
    echo "[ERROR] Deployment cancelled. $ACTIVE remains live."
    exit 1
fi

# 8. Save current Nginx configuration
BACKUP="$HOME/nginx-before-deploy.conf"

echo "[INFO] Backing up current Nginx configuration..."
sudo cp "$NGINX_CONF" "$BACKUP"

# 9. Switch Nginx to the new environment
echo "[INFO] Switching traffic to $TARGET..."

sudo sed -i \
    -e "s|127.0.0.1:$OLD_WEB|127.0.0.1:$NEW_WEB|g" \
    -e "s|127.0.0.1:$OLD_CRM|127.0.0.1:$NEW_CRM|g" \
    -e "s|127.0.0.1:$OLD_ADMIN|127.0.0.1:$NEW_ADMIN|g" \
    "$NGINX_CONF"

if ! sudo nginx -t; then
    echo "[ERROR] Nginx validation failed. Restoring previous configuration."
    sudo cp "$BACKUP" "$NGINX_CONF"
    sudo nginx -t && sudo systemctl reload nginx
    exit 1
fi

if ! sudo systemctl reload nginx; then
    echo "[ERROR] Nginx reload failed. Restoring previous configuration."
    sudo cp "$BACKUP" "$NGINX_CONF"
    sudo nginx -t && sudo systemctl reload nginx
    exit 1
fi

# 10. Verify traffic through Nginx
check_domain() {
    local domain="$1"
    local code

    code=$(curl -k -sS -o /dev/null \
        --connect-timeout 5 \
        --max-time 15 \
        --resolve "$domain:443:127.0.0.1" \
        -w '%{http_code}' \
        "https://$domain/" 2>/dev/null || true)

    if [[ "$code" =~ ^[23][0-9][0-9]$ ]]; then
        echo "[OK] $domain returned HTTP $code"
        return 0
    fi

    echo "[ERROR] $domain returned HTTP $code"
    return 1
}

if ! check_domain "glowvitasalon.com" ||
   ! check_domain "partners.glowvitasalon.com" ||
   ! check_domain "admin.glowvitasalon.com"; then

    echo "[ERROR] Post-switch verification failed."
    echo "[INFO] Rolling back to $ACTIVE..."

    sudo cp "$BACKUP" "$NGINX_CONF"
    sudo nginx -t && sudo systemctl reload nginx

    echo "[INFO] Previous environment remains available."
    exit 1
fi

echo "========================================"
echo "[SUCCESS] Deployment completed!"
echo "[SUCCESS] LIVE environment: $TARGET"
echo "[INFO] Previous environment: $ACTIVE"
echo "[INFO] Previous containers have NOT been removed."
echo "========================================"
