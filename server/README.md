# AI Telephony Backend

Professional Node.js backend server for AI-powered telephony platform with Asterisk ARI, Twilio SIP, and Supabase integration.

## Features

- **Asterisk ARI Integration**: Real-time call control and audio streaming
- **AI Pipeline**: STT (Whisper) → GPT-4 → TTS (OpenAI)
- **Supabase Database**: PostgreSQL with Row Level Security
- **Real-time Communication**: Socket.IO for WebSocket connections
- **Twilio SIP**: PSTN call handling and SIP trunking
- **Authentication**: JWT-based user authentication
- **TypeScript**: Type-safe codebase
- **Production-Ready**: PM2 clustering, logging, error handling

## Architecture

```
/server
  /src
    /ari              # Asterisk ARI client and integration
    /config           # Environment configuration and Supabase
    /controllers      # REST API endpoint handlers
    /middleware       # Auth, validation, error handling
    /routes           # Express route definitions
    /services         # Business logic (calls, AI pipeline)
      /ai             # STT, GPT, TTS services
    /sockets          # Socket.IO real-time communication
    /twilio           # Twilio SIP integration
    /utils            # Helpers (auth, audio, logging)
  /database
    /migrations       # Supabase SQL migrations
  app.ts              # Express app setup
  server.ts           # Server entry point
```

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Asterisk with ARI enabled
- Supabase project (or PostgreSQL database)
- OpenAI API key
- Twilio account (optional, for PSTN)
- Redis (optional, for Bull queue)

## Installation

### 1. Clone and Install Dependencies

```bash
cd server
npm install
```

### 2. Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Server
PORT=3000
NODE_ENV=production
API_BASE_URL=http://localhost:3000

# Supabase (REQUIRED)
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SECRET_SERVICE_ROLE_KEY
SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_KEY

# Asterisk ARI
ASTERISK_ARI_URL=http://localhost:8088
ASTERISK_ARI_USERNAME=ariuser
ASTERISK_ARI_PASSWORD=aripassword
ASTERISK_ARI_APP_NAME=ai-telephony

# OpenAI
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Twilio (Optional)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1234567890

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

### 3. Database Setup

#### Option A: Supabase (Recommended)

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Copy your project URL and service role key to `.env`
3. Run the migration SQL in Supabase SQL Editor:

```bash
# Copy the contents of database/migrations/001_initial_schema.sql
# Paste and execute in Supabase SQL Editor
```

#### Option B: Self-hosted PostgreSQL

If using your own PostgreSQL, ensure Supabase client compatibility or modify the database layer.

### 4. Asterisk Configuration

Configure Asterisk with ARI enabled. Add to `/etc/asterisk/ari.conf`:

```ini
[general]
enabled = yes
pretty = yes

[ariuser]
type = user
password = aripassword
password_format = plain
```

Add to `/etc/asterisk/extensions.conf`:

```ini
[default]
exten => _X.,1,NoOp(Incoming call to AI)
 same => n,Stasis(ai-telephony)
 same => n,Hangup()
```

Restart Asterisk:

```bash
sudo asterisk -rx "core reload"
```

## Usage

### Development Mode

```bash
npm run dev
```

### Production Build

```bash
npm run build
npm start
```

### Production with PM2

```bash
npm run start:pm2
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/verify` - Verify JWT token
- `GET /api/auth/profile` - Get user profile (requires auth)

### Calls

- `POST /api/calls/initiate` - Start outbound call (requires auth)
- `POST /api/calls/:callSessionId/end` - End active call (requires auth)
- `GET /api/calls/history` - Get call history (requires auth)
- `GET /api/calls/:callSessionId` - Get call details (requires auth)
- `GET /api/calls/:callSessionId/messages` - Get call messages (requires auth)
- `POST /api/calls/:callSessionId/messages` - Send message in call (requires auth)

### Twilio Webhooks

- `POST /api/twilio/voice` - Voice webhook
- `POST /api/twilio/status` - Status callback
- `POST /api/twilio/call` - Make outbound call (requires auth)
- `POST /api/twilio/call/:callSid/end` - End Twilio call (requires auth)

### Health Check

- `GET /api/health` - Server health status

## Socket.IO Events

### Client → Server

- `authenticate` - Authenticate socket connection
- `call:start` - Initiate call
- `call:end` - End call
- `call:audio` - Send audio data
- `call:message` - Send text message

### Server → Client

- `authenticated` - Authentication successful
- `call:started` - Call initiated
- `call:ended` - Call ended
- `call:status` - Call status update
- `call:transcription` - Audio transcribed to text
- `call:ai-response` - AI response received
- `call:message` - New message in call
- `call:error` - Error occurred

## Security

### Critical Security Rules

1. **NEVER expose Supabase service role key to frontend**
2. **Use HTTPS/WSS in production**
3. **Enable Row Level Security (RLS) on all Supabase tables**
4. **Rotate JWT secret regularly**
5. **Validate all user inputs**
6. **Rate limit API endpoints**

### Row Level Security

The database schema includes RLS policies. Frontend uses `SUPABASE_ANON_KEY`, backend uses `SUPABASE_SERVICE_ROLE_KEY`.

## Testing

### Manual Testing

```bash
# Health check
curl http://localhost:3000/api/health

# Register user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Initiate call (with JWT token)
curl -X POST http://localhost:3000/api/calls/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"phoneNumber":"+1234567890"}'
```

## Deployment

### Docker Deployment (Recommended)

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

Build and run:

```bash
docker build -t ai-telephony-backend .
docker run -p 3000:3000 --env-file .env ai-telephony-backend
```

### PM2 Deployment

```bash
npm run build
npm run start:pm2

# Monitor
pm2 logs ai-telephony-backend
pm2 monit

# Stop
pm2 stop ai-telephony-backend
```

### NGINX Reverse Proxy

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
```

## Troubleshooting

### Asterisk ARI Connection Failed

- Verify Asterisk is running: `sudo asterisk -rx "core show version"`
- Check ARI configuration: `sudo asterisk -rx "ari show users"`
- Ensure ARI URL and credentials are correct in `.env`

### Supabase Connection Issues

- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are correct
- Check Supabase project is active
- Ensure database tables are created via migration SQL

### OpenAI API Errors

- Verify `OPENAI_API_KEY` is valid
- Check API quota and billing
- Ensure models (gpt-4, whisper-1, tts-1) are available

### Socket.IO Connection Issues

- Check CORS settings in `.env`
- Verify frontend uses correct WebSocket URL
- Ensure firewall allows WebSocket connections

## Logging

Logs are written to `logs/` directory:

- `logs/app.log` - All logs
- `logs/app-error.log` - Error logs only

In production, logs are JSON formatted. In development, logs are colorized console output.

## License

MIT

## Support

For issues and questions, please open an issue in the repository.
