# Deployment Guide - AI Telephony Backend

This guide provides comprehensive deployment instructions for production environments.

## Table of Contents

1. [Pre-deployment Checklist](#pre-deployment-checklist)
2. [Environment Setup](#environment-setup)
3. [Database Setup](#database-setup)
4. [Asterisk Configuration](#asterisk-configuration)
5. [Application Deployment](#application-deployment)
6. [Reverse Proxy Setup](#reverse-proxy-setup)
7. [SSL/TLS Configuration](#ssltls-configuration)
8. [Monitoring & Logging](#monitoring--logging)
9. [Scaling](#scaling)
10. [Backup & Recovery](#backup--recovery)

## Pre-deployment Checklist

- [ ] Node.js 18+ installed on server
- [ ] Asterisk server accessible
- [ ] Supabase project created or PostgreSQL database ready
- [ ] OpenAI API key obtained
- [ ] Domain name configured (optional but recommended)
- [ ] SSL certificate obtained (Let's Encrypt recommended)
- [ ] Firewall rules configured
- [ ] Twilio account setup (if using PSTN)

## Environment Setup

### 1. Server Requirements

**Minimum Requirements:**
- CPU: 2 cores
- RAM: 4 GB
- Storage: 20 GB SSD
- OS: Ubuntu 20.04+ or similar Linux distribution

**Recommended for Production:**
- CPU: 4+ cores
- RAM: 8+ GB
- Storage: 50+ GB SSD
- OS: Ubuntu 22.04 LTS

### 2. Install Node.js

```bash
# Using NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

### 3. Install PM2 (Process Manager)

```bash
sudo npm install -g pm2

# Configure PM2 to start on system boot
pm2 startup
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp /home/$USER
```

### 4. Clone Repository

```bash
git clone <your-repository-url>
cd ai-telephony-backend/server
npm install
```

### 5. Configure Environment Variables

```bash
cp .env.example .env
nano .env
```

**Production Environment Variables:**

```env
# Server Configuration
PORT=3000
NODE_ENV=production
API_BASE_URL=https://api.yourdomain.com

# Supabase Configuration
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SECRET_SERVICE_ROLE_KEY
SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_KEY

# Asterisk ARI Configuration
ASTERISK_ARI_URL=http://asterisk-server:8088
ASTERISK_ARI_USERNAME=ariuser
ASTERISK_ARI_PASSWORD=STRONG_PASSWORD_HERE
ASTERISK_ARI_APP_NAME=ai-telephony

# OpenAI Configuration
OPENAI_API_KEY=sk-ACTUAL_KEY_HERE
OPENAI_MODEL=gpt-4-turbo-preview
OPENAI_TTS_MODEL=tts-1
OPENAI_TTS_VOICE=alloy
OPENAI_WHISPER_MODEL=whisper-1

# Twilio Configuration (Optional)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_SIP_DOMAIN=your-domain.sip.twilio.com

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# JWT Configuration
JWT_SECRET=$(openssl rand -base64 32)
JWT_EXPIRES_IN=7d

# Security
CORS_ORIGIN=https://yourdomain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=/var/log/ai-telephony/app.log
```

**Security Best Practices:**

```bash
# Set proper file permissions
chmod 600 .env

# Ensure .env is in .gitignore
echo ".env" >> .gitignore
```

## Database Setup

### Supabase Setup

1. **Create Project:**
   - Go to [supabase.com](https://supabase.com)
   - Create new project
   - Copy project URL and service role key

2. **Run Migration:**
   - Open Supabase SQL Editor
   - Copy contents of `database/migrations/001_initial_schema.sql`
   - Execute the SQL

3. **Create Storage Bucket (Optional):**
   ```sql
   INSERT INTO storage.buckets (id, name, public)
   VALUES ('call-recordings', 'call-recordings', false);
   ```

4. **Verify RLS Policies:**
   - Ensure Row Level Security is enabled on all tables
   - Test policies with frontend anon key

### PostgreSQL Setup (Alternative)

If using self-hosted PostgreSQL:

```bash
sudo apt-get install postgresql postgresql-contrib

sudo -u postgres psql
CREATE DATABASE ai_telephony;
CREATE USER ai_telephony_user WITH PASSWORD 'strong_password';
GRANT ALL PRIVILEGES ON DATABASE ai_telephony TO ai_telephony_user;
\q
```

Run migrations:

```bash
psql -U ai_telephony_user -d ai_telephony -f database/migrations/001_initial_schema.sql
```

## Asterisk Configuration

### 1. Install Asterisk

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install asterisk

# Verify installation
sudo asterisk -rvvv
```

### 2. Enable ARI

Edit `/etc/asterisk/ari.conf`:

```ini
[general]
enabled = yes
pretty = yes
allowed_origins = *

[ariuser]
type = user
password = STRONG_PASSWORD_HERE
password_format = plain
```

### 3. Configure Dialplan

Edit `/etc/asterisk/extensions.conf`:

```ini
[ai-telephony]
exten => _X.,1,NoOp(AI Telephony Incoming Call)
 same => n,Answer()
 same => n,Stasis(ai-telephony)
 same => n,Hangup()

[from-external]
exten => _X.,1,NoOp(External Incoming Call)
 same => n,Goto(ai-telephony,${EXTEN},1)
```

### 4. Configure PJSIP (for SIP)

Edit `/etc/asterisk/pjsip.conf`:

```ini
[transport-udp]
type = transport
protocol = udp
bind = 0.0.0.0:5060

[transport-tcp]
type = transport
protocol = tcp
bind = 0.0.0.0:5060

[ai-telephony-endpoint]
type = endpoint
context = ai-telephony
disallow = all
allow = ulaw
allow = alaw
```

### 5. Restart Asterisk

```bash
sudo systemctl restart asterisk
sudo asterisk -rx "core reload"
sudo asterisk -rx "ari show users"
```

## Application Deployment

### Method 1: PM2 (Recommended)

```bash
# Build application
npm run build

# Start with PM2
npm run start:pm2

# Verify running
pm2 list
pm2 logs ai-telephony-backend

# Save PM2 configuration
pm2 save

# Monitor
pm2 monit
```

### Method 2: Docker

**Create Dockerfile:**

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

RUN mkdir -p /app/logs /app/recordings

EXPOSE 3000

CMD ["node", "dist/server.js"]
```

**Build and Run:**

```bash
# Build image
docker build -t ai-telephony-backend .

# Run container
docker run -d \
  --name ai-telephony \
  --restart unless-stopped \
  -p 3000:3000 \
  -v $(pwd)/logs:/app/logs \
  -v $(pwd)/recordings:/app/recordings \
  --env-file .env \
  ai-telephony-backend

# Check logs
docker logs -f ai-telephony
```

### Method 3: Docker Compose

**Create `docker-compose.yml`:**

```yaml
version: '3.8'

services:
  app:
    build: .
    container_name: ai-telephony-backend
    restart: unless-stopped
    ports:
      - "3000:3000"
    env_file:
      - .env
    volumes:
      - ./logs:/app/logs
      - ./recordings:/app/recordings
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    container_name: ai-telephony-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
```

**Run:**

```bash
docker-compose up -d
docker-compose logs -f
```

## Reverse Proxy Setup

### NGINX Configuration

```bash
sudo apt-get install nginx
```

**Create configuration file `/etc/nginx/sites-available/ai-telephony`:**

```nginx
upstream ai_telephony_backend {
    server localhost:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name api.yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Client body size (for audio uploads)
    client_max_body_size 10M;

    # API Routes
    location / {
        proxy_pass http://ai_telephony_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.IO WebSocket
    location /socket.io/ {
        proxy_pass http://ai_telephony_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # Logs
    access_log /var/log/nginx/ai-telephony-access.log;
    error_log /var/log/nginx/ai-telephony-error.log;
}
```

**Enable configuration:**

```bash
sudo ln -s /etc/nginx/sites-available/ai-telephony /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## SSL/TLS Configuration

### Let's Encrypt (Certbot)

```bash
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d api.yourdomain.com

# Auto-renewal
sudo certbot renew --dry-run
```

## Monitoring & Logging

### 1. Application Logs

```bash
# Create log directory
sudo mkdir -p /var/log/ai-telephony
sudo chown $USER:$USER /var/log/ai-telephony

# View logs
tail -f /var/log/ai-telephony/app.log
tail -f /var/log/ai-telephony/app-error.log
```

### 2. PM2 Monitoring

```bash
pm2 monit
pm2 logs ai-telephony-backend --lines 100
```

### 3. Log Rotation

Create `/etc/logrotate.d/ai-telephony`:

```
/var/log/ai-telephony/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 $USER $USER
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

## Scaling

### Horizontal Scaling with PM2

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'ai-telephony-backend',
    script: './dist/server.js',
    instances: 'max',  // Use all CPU cores
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
    },
  }],
};
```

### Load Balancing with NGINX

```nginx
upstream ai_telephony_backend {
    least_conn;
    server server1:3000 weight=1;
    server server2:3000 weight=1;
    server server3:3000 weight=1;
    keepalive 64;
}
```

## Backup & Recovery

### Database Backups (Supabase)

Supabase provides automatic backups. For manual backups:

```bash
# PostgreSQL dump (if self-hosted)
pg_dump -U ai_telephony_user ai_telephony > backup_$(date +%Y%m%d).sql
```

### Application Backups

```bash
# Backup script
#!/bin/bash
BACKUP_DIR="/backups/ai-telephony"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup logs
tar -czf $BACKUP_DIR/logs_$DATE.tar.gz /var/log/ai-telephony/

# Backup recordings
tar -czf $BACKUP_DIR/recordings_$DATE.tar.gz /path/to/recordings/

# Keep only last 30 days
find $BACKUP_DIR -type f -mtime +30 -delete
```

## Health Checks

```bash
# Simple health check script
#!/bin/bash
HEALTH_ENDPOINT="http://localhost:3000/api/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_ENDPOINT)

if [ $RESPONSE -eq 200 ]; then
    echo "✓ Server is healthy"
    exit 0
else
    echo "✗ Server is unhealthy (HTTP $RESPONSE)"
    exit 1
fi
```

## Post-Deployment Verification

```bash
# Test health endpoint
curl https://api.yourdomain.com/api/health

# Test authentication
curl -X POST https://api.yourdomain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'

# Monitor logs
pm2 logs --lines 50
```

## Troubleshooting

### Service won't start

```bash
# Check logs
pm2 logs ai-telephony-backend --err

# Check configuration
pm2 describe ai-telephony-backend

# Restart
pm2 restart ai-telephony-backend
```

### High CPU usage

```bash
# Monitor processes
pm2 monit

# Reduce instances
pm2 scale ai-telephony-backend 2
```

### Memory leaks

```bash
# Set max memory restart
pm2 start ecosystem.config.js --max-memory-restart 1G
```

## Security Hardening

1. **Use firewall (UFW):**

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

2. **Disable root login:**

```bash
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
sudo systemctl restart sshd
```

3. **Keep system updated:**

```bash
sudo apt-get update
sudo apt-get upgrade
sudo apt-get autoremove
```

## Support

For deployment issues, refer to the main README.md or open an issue in the repository.
