#!/bin/bash

# ===========================================
# ComHub AI Deployment Script
# Run this on your VPS to deploy the application
# ===========================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}   ComHub AI Deployment Script${NC}"
echo -e "${GREEN}=========================================${NC}"

# Configuration
APP_DIR="/home/comhub-ai"
DOMAIN="voip.comhubai.com"

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root or with sudo${NC}"
    exit 1
fi

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Step 1: Update system
echo -e "\n${YELLOW}[1/10] Updating system packages...${NC}"
apt update && apt upgrade -y

# Step 2: Install Node.js 20.x
echo -e "\n${YELLOW}[2/10] Installing Node.js 20.x...${NC}"
if ! command_exists node; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi
node -v
npm -v

# Step 3: Install PM2
echo -e "\n${YELLOW}[3/10] Installing PM2...${NC}"
if ! command_exists pm2; then
    npm install -g pm2
fi
pm2 -v

# Step 4: Install Nginx
echo -e "\n${YELLOW}[4/10] Installing Nginx...${NC}"
if ! command_exists nginx; then
    apt install -y nginx
fi
nginx -v

# Step 5: Install Certbot for SSL
echo -e "\n${YELLOW}[5/10] Installing Certbot...${NC}"
if ! command_exists certbot; then
    apt install -y certbot python3-certbot-nginx
fi

# Step 6: Create application directory
echo -e "\n${YELLOW}[6/10] Setting up application directory...${NC}"
mkdir -p $APP_DIR
mkdir -p /var/log/pm2
mkdir -p /var/log/comhubai
mkdir -p /var/www/certbot

# Step 7: Set permissions
echo -e "\n${YELLOW}[7/10] Setting permissions...${NC}"
chown -R www-data:www-data $APP_DIR
chmod -R 755 $APP_DIR

# Step 8: Setup Nginx
echo -e "\n${YELLOW}[8/10] Configuring Nginx...${NC}"
if [ -f "$APP_DIR/deploy/nginx.conf" ]; then
    cp $APP_DIR/deploy/nginx.conf /etc/nginx/sites-available/$DOMAIN
    ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    nginx -t && systemctl reload nginx
    echo -e "${GREEN}Nginx configured successfully${NC}"
else
    echo -e "${YELLOW}Nginx config not found. Copy it manually later.${NC}"
fi

# Step 9: Setup SSL with Let's Encrypt
echo -e "\n${YELLOW}[9/10] Setting up SSL certificate...${NC}"
echo -e "${YELLOW}Make sure your domain DNS is pointing to this server!${NC}"
read -p "Do you want to setup SSL now? (y/n): " setup_ssl
if [ "$setup_ssl" = "y" ]; then
    certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN || {
        echo -e "${YELLOW}SSL setup failed. You can run it manually later:${NC}"
        echo -e "certbot --nginx -d $DOMAIN"
    }
fi

# Step 10: Setup PM2 startup
echo -e "\n${YELLOW}[10/10] Configuring PM2 startup...${NC}"
pm2 startup systemd -u root --hp /root
pm2 save

# Final instructions
echo -e "\n${GREEN}=========================================${NC}"
echo -e "${GREEN}   Deployment Setup Complete!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo -e "\n${YELLOW}Next steps:${NC}"
echo -e "1. Upload your code to: $APP_DIR"
echo -e "2. Setup environment files:"
echo -e "   - Copy deploy/server.env.production to server/.env"
echo -e "   - Copy deploy/client.env.production to client/.env.production"
echo -e "3. Build and start the application:"
echo -e "   ${GREEN}cd $APP_DIR/server && npm install && npm run build${NC}"
echo -e "   ${GREEN}cd $APP_DIR/client && npm install && npm run build${NC}"
echo -e "   ${GREEN}cd $APP_DIR/server && pm2 start ecosystem.config.js${NC}"
echo -e "4. Save PM2 process list: ${GREEN}pm2 save${NC}"
echo -e "\n${YELLOW}Useful commands:${NC}"
echo -e "  pm2 status           - Check app status"
echo -e "  pm2 logs             - View logs"
echo -e "  pm2 restart all      - Restart all apps"
echo -e "  nginx -t             - Test nginx config"
echo -e "  systemctl reload nginx - Reload nginx"
