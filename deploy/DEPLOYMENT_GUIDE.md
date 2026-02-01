# ComHub AI Deployment Guide

Deploy the application to **voip.comhubai.com** on your VPS.

## Prerequisites

- Ubuntu 20.04+ VPS
- Domain DNS pointing to VPS IP (voip.comhubai.com → YOUR_VPS_IP)
- SSH access to VPS

## Quick Deployment Steps

### Step 1: Connect to VPS

```bash
ssh root@YOUR_VPS_IP
```

### Step 2: Upload Code to VPS

**Option A: Using Git (Recommended)**
```bash
cd /var/www
git clone YOUR_REPO_URL comhubai
```

**Option B: Using SCP (from your local machine)**
```bash
# Run this from your local machine (Windows PowerShell)
scp -r f:\comhubai.com\* root@YOUR_VPS_IP:/home/comhub-ai/
```

**Option C: Using FileZilla/SFTP**
- Connect to VPS via SFTP
- Upload all files to `/home/comhub-ai/`

### Step 3: Run Deployment Script

```bash
cd /home/comhub-ai
chmod +x deploy/deploy.sh
sudo ./deploy/deploy.sh
```

This script will:
- Install Node.js 20.x
- Install PM2
- Install Nginx
- Install Certbot (for SSL)
- Create required directories
- Setup PM2 startup

### Step 4: Configure Environment Files

**Server Environment:**
```bash
cd /home/comhub-ai/server
cp ../deploy/server.env.production .env
nano .env  # Edit with your actual values
```

**Client Environment:**
```bash
cd /home/comhub-ai/client
cp ../deploy/client.env.production .env.production
nano .env.production  # Edit with your actual values
```

### Step 5: Build Applications

```bash
# Build Server
cd /home/comhub-ai/server
npm install
npm run build

# Build Client
cd /home/comhub-ai/client
npm install
npm run build
```

### Step 6: Setup Nginx

```bash
# Copy nginx config
sudo cp /home/comhub-ai/deploy/nginx.conf /etc/nginx/sites-available/voip.comhubai.com

# Enable site
sudo ln -sf /etc/nginx/sites-available/voip.comhubai.com /etc/nginx/sites-enabled/

# Remove default
sudo rm -f /etc/nginx/sites-enabled/default

# Test config
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

### Step 7: Setup SSL Certificate

```bash
sudo certbot --nginx -d voip.comhubai.com
```

### Step 8: Start Server with PM2

```bash
cd /home/comhub-ai/server
pm2 start ecosystem.config.js
pm2 save
```

### Step 9: Verify Deployment

Visit: https://voip.comhubai.com

Check status:
```bash
pm2 status
pm2 logs
```

---

## Environment Variables Reference

### Server (.env)

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `production` |
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service key | `eyJ...` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |
| `JWT_SECRET` | JWT signing secret | Random 32+ char string |
| `CORS_ORIGIN` | Allowed origin | `https://voip.comhubai.com` |

### Client (.env.production)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | API endpoint | `https://voip.comhubai.com/api` |
| `VITE_WS_URL` | WebSocket URL | `https://voip.comhubai.com` |
| `VITE_SUPABASE_URL` | Supabase URL | `https://xxx.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key | `eyJ...` |

---

## Useful Commands

### PM2 Commands
```bash
pm2 status              # Check app status
pm2 logs                # View all logs
pm2 logs comhubai-server # View specific app logs
pm2 restart all         # Restart all apps
pm2 stop all            # Stop all apps
pm2 delete all          # Delete all apps
pm2 monit               # Real-time monitoring
```

### Nginx Commands
```bash
nginx -t                  # Test configuration
systemctl reload nginx    # Reload config
systemctl restart nginx   # Restart nginx
systemctl status nginx    # Check status
```

### SSL Commands
```bash
certbot renew --dry-run   # Test renewal
certbot certificates      # List certificates
```

---

## Updating the Application

Run the update script:
```bash
cd /home/comhub-ai
./deploy/update.sh
```

Or manually:
```bash
# Pull latest code
cd /home/comhub-ai
git pull

# Rebuild server
cd server
npm install
npm run build

# Rebuild client
cd ../client
npm install
npm run build

# Restart server
pm2 restart comhubai-server
```

---

## Troubleshooting

### Check Logs
```bash
# PM2 logs
pm2 logs

# Nginx error log
tail -f /var/log/nginx/error.log

# Application logs
tail -f /var/log/comhubai/app.log
```

### Common Issues

**502 Bad Gateway**
- Server not running: `pm2 status`
- Port mismatch: Check PORT in .env matches nginx upstream

**SSL Issues**
- Ensure DNS is pointing to VPS
- Re-run: `certbot --nginx -d voip.comhubai.com`

**Permission Errors**
```bash
chown -R www-data:www-data /home/comhub-ai
chmod -R 755 /home/comhub-ai
```

**Build Failures**
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules
npm install
```

---

## File Structure on VPS

```
/home/comhub-ai/
├── client/
│   ├── dist/          # Built React app (served by Nginx)
│   ├── src/
│   ├── .env.production
│   └── package.json
├── server/
│   ├── dist/          # Built Node.js app
│   ├── src/
│   ├── .env
│   ├── ecosystem.config.js
│   └── package.json
└── deploy/
    ├── nginx.conf
    ├── deploy.sh
    ├── update.sh
    └── DEPLOYMENT_GUIDE.md
```

---

## Security Checklist

- [ ] Change default JWT_SECRET
- [ ] Use strong database passwords
- [ ] Enable UFW firewall
- [ ] Keep system updated
- [ ] Setup automatic SSL renewal
- [ ] Restrict SSH access (key-only)
- [ ] Setup fail2ban
