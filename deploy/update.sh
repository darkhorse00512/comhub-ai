#!/bin/bash

# ===========================================
# ComHub AI Update Script
# Run this to update the application after code changes
# ===========================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

APP_DIR="/var/www/comhubai"

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}   ComHub AI Update Script${NC}"
echo -e "${GREEN}=========================================${NC}"

# Navigate to app directory
cd $APP_DIR

# Pull latest code (if using git)
if [ -d ".git" ]; then
    echo -e "\n${YELLOW}Pulling latest changes...${NC}"
    git pull origin master
fi

# Update and build server
echo -e "\n${YELLOW}Building server...${NC}"
cd $APP_DIR/server
npm install
npm run build

# Update and build client
echo -e "\n${YELLOW}Building client...${NC}"
cd $APP_DIR/client
npm install
npm run build

# Restart PM2
echo -e "\n${YELLOW}Restarting server...${NC}"
pm2 restart comhubai-server

# Save PM2 state
pm2 save

echo -e "\n${GREEN}=========================================${NC}"
echo -e "${GREEN}   Update Complete!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo -e "Run 'pm2 logs' to check for any errors"
