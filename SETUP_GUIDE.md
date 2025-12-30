# ComHub AI - Complete Setup Guide

## 📋 Overview

This guide will help you set up the complete ComHub AI telephony system with all features:
- Phone number management (import from Twilio)
- Groups & SIP configuration
- AI voice conversations
- Usage analytics
- User settings & feedback

---

## 🗄️ Step 1: Database Setup (Supabase)

### 1.1 Run the SQL Migration

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Select your project
3. Click on **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy and paste the entire contents of `database/schema.sql`
6. Click **Run** or press `Ctrl+Enter`

This will create all necessary tables:
- ✅ users
- ✅ user_settings
- ✅ groups
- ✅ phone_numbers
- ✅ call_sessions
- ✅ call_messages
- ✅ call_recordings
- ✅ bulk_call_jobs
- ✅ bulk_call_numbers
- ✅ feedback
- ✅ usage_statistics

### 1.2 Verify Storage Bucket

1. Go to **Storage** in Supabase
2. Verify `call-recordings` bucket exists (created automatically by the app)
3. Make sure it's set to **Public** access

---

## ⚙️ Step 2: Server Configuration

### 2.1 Environment Variables

Update your `server/.env` file:

```env
# Server Configuration
PORT=3000
NODE_ENV=development
API_BASE_URL=https://YOUR_DOMAIN.com  # ⚠️ MUST be HTTPS for Twilio

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# OpenAI Configuration
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo-preview
OPENAI_TTS_MODEL=tts-1
OPENAI_TTS_VOICE=alloy
OPENAI_WHISPER_MODEL=whisper-1

# Twilio Configuration (YOUR ACCOUNT)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+4915888656842
TWILIO_SIP_DOMAIN=comhubai.pstn.twilio.com

# JWT Configuration
JWT_SECRET=your-secure-random-secret-key
JWT_EXPIRES_IN=7d

# Security Configuration
CORS_ORIGIN=https://your-frontend-domain.com

# Redis Configuration (optional)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

### 2.2 Install Dependencies

```bash
cd server
npm install
```

### 2.3 Start the Server

```bash
npm run dev
```

---

## 🌐 Step 3: Twilio Configuration

### 3.1 Configure Webhook URL

1. Go to Twilio Console: https://console.twilio.com
2. Navigate to **Phone Numbers → Manage → Active Numbers**
3. Click on your phone number `+4915888656842`
4. Under **Voice Configuration**:
   - **Configure with:** Webhook
   - **A call comes in:** Webhook
   - **URL:** `https://YOUR_HTTPS_DOMAIN/api/twilio/voice`
   - **HTTP Method:** POST
   - **Status Callback URL:** `https://YOUR_HTTPS_DOMAIN/api/twilio/status`

### 3.2 Enable HTTPS (CRITICAL!)

Twilio requires HTTPS. Choose one option:

**Option A: Use ngrok for testing**
```bash
ngrok http 3000
# Then update API_BASE_URL in .env to the ngrok URL
```

**Option B: Set up nginx with SSL (production)**
```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Get free SSL certificate:
```bash
sudo certbot --nginx -d your-domain.com
```

---

## 💻 Step 4: Frontend Configuration

### 4.1 Environment Variables

Create/update `client/.env`:

```env
VITE_API_BASE_URL=https://YOUR_HTTPS_DOMAIN/api
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4.2 Install Dependencies

```bash
cd client
npm install
```

### 4.3 Start the Frontend

```bash
npm run dev
```

---

## 🔧 Step 5: Using the Features

### 5.1 Phone Number Management

**Import Your Existing Twilio Number:**

1. Go to **Dashboard → Telephony → Phone Numbers**
2. Click **Add Phone Number**
3. Choose **Import existing number**
4. Enter:
   - **Twilio Account SID:** `ACxxxxxxxxxxxxx`
   - **Twilio Auth Token:** Your auth token
   - **Phone Number SID:** `PNxxxxxxxxxxxxx`
5. Click **Import Number**

**Find Your Phone Number SID:**
```bash
# Using Twilio CLI
twilio phone-numbers:list

# Or in Twilio Console:
# Phone Numbers → Manage → Active Numbers → Click on number → Copy SID
```

### 5.2 Create Groups

1. Go to **Dashboard → Groups**
2. Click **Create Group**
3. Enter name and description
4. The system auto-generates a SIP password
5. Copy the SIP password for your softphone configuration

### 5.3 SIP Configuration

After creating a group, use these settings in your softphone:

**Username:** Your phone number (e.g., +4915888656842)
**Password:** The generated SIP password from the group
**Domain:** `comhubai.pstn.frankfurt.twilio.com` (or your region)

**Example SIP URI:**
```
sip:+4915888656842@comhubai.pstn.frankfurt.twilio.com
```

### 5.4 AI Settings

1. Go to **Dashboard → Settings → AI Config**
2. Configure:
   - Voice Model (alloy, echo, nova, etc.)
   - Language
   - Greeting message
   - Max call duration
   - Silence timeout
3. Click **Save AI Settings**

### 5.5 View Usage Analytics

1. Go to **Dashboard → Usage**
2. View:
   - Total calls
   - Inbound vs Outbound
   - Minutes used
   - Success rate
   - Daily activity

---

## 🧪 Step 6: Testing

### 6.1 Test Configuration

Visit: `https://YOUR_DOMAIN/api/config-check`

This will show:
```json
{
  "success": true,
  "config": {
    "apiBaseUrl": "https://your-domain.com",
    "isHttps": true,
    "twilioWebhookUrl": "https://your-domain.com/api/twilio/voice",
    "warnings": [],
    "status": {
      "twilio": "OK",
      "openai": "OK",
      "supabase": "OK",
      "https": "OK"
    }
  }
}
```

### 6.2 Test Inbound Call

**Quick Test (No Phone):**
1. Go to **Dashboard → Home**
2. Click **Inbound Test** tab
3. Click **Run Quick Test**
4. Check **History** for the simulated conversation

**Full Test (Real Phone):**
1. Go to **Dashboard → Home**
2. Click **Inbound Test** tab
3. Enter your phone number
4. Click **Call My Phone**
5. Answer the call and speak with the AI

**Manual Test:**
1. Call `+4915888656842` from any phone
2. AI should answer with the greeting
3. Speak and have a conversation
4. Check **History** for the transcript

### 6.3 Test Outbound Call

1. Go to **Dashboard → Home**
2. Enter a phone number (with country code)
3. Click **Start Call**
4. AI will call the number and start conversation

---

## 📊 Step 7: Database Tables Explained

### Core Tables

**users** - User accounts
**user_settings** - Personal preferences and AI configuration
**phone_numbers** - Imported/purchased Twilio numbers
**groups** - Organization groups with SIP passwords
**call_sessions** - All call records
**call_messages** - Conversation transcripts
**usage_statistics** - Daily analytics (auto-updated)
**feedback** - User feedback submissions

### Relationships

```
users (1) ─── (M) phone_numbers
users (1) ─── (M) groups
users (1) ─── (M) call_sessions
groups (1) ─── (M) phone_numbers
call_sessions (1) ─── (M) call_messages
```

---

## 🔒 Security Features

✅ **Row Level Security (RLS)** enabled on all tables
✅ **JWT authentication** for all API endpoints
✅ **User data isolation** - users can only access their own data
✅ **Secure password storage** for groups
✅ **HTTPS required** for Twilio webhooks
✅ **CORS protection**

---

## 🐛 Troubleshooting

### Issue: "Application error has occurred" when calling

**Solution:**
1. Check server logs: `tail -f server/logs/app.log`
2. Verify HTTPS is working
3. Test webhook: `curl https://YOUR_DOMAIN/api/twilio/voice`
4. Check Twilio webhook configuration

### Issue: Audio not playing

**Solution:**
1. Verify Supabase bucket `call-recordings` is public
2. Check OpenAI API key is valid
3. Look for errors in server logs

### Issue: Can't import phone number

**Solution:**
1. Verify Twilio credentials are correct
2. Check Phone Number SID format: `PN...`
3. Ensure you're using the same Twilio account

### Issue: Usage statistics not updating

**Solution:**
1. Check database trigger is installed: `update_usage_stats_on_call_end`
2. Verify calls are ending properly (status = 'ended')

---

## 📞 API Endpoints Reference

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login

### Phone Numbers
- `GET /api/phone-numbers` - List phone numbers
- `POST /api/phone-numbers/import` - Import number
- `PUT /api/phone-numbers/:id` - Update number
- `DELETE /api/phone-numbers/:id` - Delete number

### Groups
- `GET /api/groups` - List groups
- `POST /api/groups` - Create group
- `PUT /api/groups/:id` - Update group
- `DELETE /api/groups/:id` - Delete group

### Settings
- `GET /api/settings` - Get user settings
- `PUT /api/settings` - Update settings
- `GET /api/settings/usage` - Get usage statistics

### Feedback
- `GET /api/feedback` - List feedback
- `POST /api/feedback` - Submit feedback

### Calls
- `POST /api/calls/initiate` - Start outbound call
- `GET /api/calls/history` - Get call history
- `POST /api/calls/test-inbound` - Test inbound call

---

## 🎯 Next Steps

1. ✅ Run database migration
2. ✅ Configure environment variables
3. ✅ Set up HTTPS
4. ✅ Configure Twilio webhooks
5. ✅ Import your phone number
6. ✅ Create a group
7. ✅ Test inbound call
8. ✅ Configure AI settings
9. ✅ Start making calls!

---

## 📝 Notes

- **Always use HTTPS** - Twilio will reject HTTP webhooks
- **Keep API keys secure** - Never commit `.env` files
- **Monitor usage** - Check Twilio and OpenAI billing
- **Test thoroughly** - Use the test features before production
- **Backup database** - Regular Supabase backups recommended

---

## 🆘 Support

For issues or questions:
1. Check server logs: `tail -f server/logs/app.log`
2. Visit Twilio Console for webhook errors
3. Check Supabase logs for database errors
4. Submit feedback via **Dashboard → Feedback**

---

**Your ComHub AI is now fully configured and ready to use! 🎉**
