# Backend Setup Guide

## Current Issue: 401 Unauthorized Error

You're seeing a `401 Unauthorized` error when the frontend tries to fetch data because the **backend server is not running** or the **authentication is not properly configured**.

## Quick Start

### 1. Start the Backend Server

```bash
cd server
npm install
npm run dev
```

The backend should start on `http://168.119.180.202:3000` or `http://localhost:3000`

### 2. Verify Backend is Running

Visit: `http://168.119.180.202:3000/api/health` or `http://localhost:3000/api/health`

You should see: `{"status": "ok"}`

### 3. Configure Environment Variables

Create `server/.env` file:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here

# Twilio Configuration (for backend operations)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
```

## Authentication Flow

The app uses a two-tier authentication system:

### Frontend → Supabase Auth
1. User logs in via Supabase Auth UI
2. Supabase returns an access token
3. Frontend stores this token

### Frontend → Backend API
1. Frontend exchanges Supabase token for backend JWT
2. Backend validates Supabase token and creates its own JWT
3. Frontend includes JWT in all API requests

```typescript
// This happens automatically in api.ts
const token = await getBackendToken(); // Exchanges Supabase token for backend JWT
headers: {
  "Authorization": `Bearer ${token}`
}
```

## Testing the Setup

### 1. Test Authentication Endpoint

```bash
# First, get a Supabase token by logging in through the frontend
# Then test the backend auth endpoint:

curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "supabaseUserId": "user-uuid-here"
  }'
```

Expected response:
```json
{
  "token": "jwt-token-here"
}
```

### 2. Test Phone Numbers API

```bash
curl -X GET http://localhost:3000/api/phone-numbers \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 3. Test Groups API

```bash
curl -X GET http://localhost:3000/api/groups \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 4. Test Usage Statistics API

```bash
curl -X GET http://localhost:3000/api/settings/usage \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Database Setup

### Run the Enhanced Schema

1. Go to your Supabase SQL Editor
2. Copy and paste the contents of `database/schema.sql`
3. Execute the SQL

This will:
- Add columns to existing tables (users, call_sessions)
- Create new tables (groups, phone_numbers, user_settings, etc.)
- Set up RLS policies
- Create triggers and functions

### Verify Database Tables

Run this in Supabase SQL Editor:

```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
```

You should see:
- users
- call_sessions
- call_messages
- call_recordings
- groups
- phone_numbers
- user_settings
- bulk_call_jobs
- bulk_call_numbers
- feedback
- usage_statistics

## Frontend Features Now Available

### ✅ Telephony Page (`/dashboard/telephony`)
- **View all phone numbers** from database
- **Import phone numbers** from your Twilio account
  - Requires: Account SID, Auth Token, Phone Number SID
- **Delete phone numbers** with confirmation
- **Copy phone numbers** to clipboard
- **SIP Configuration Guide** with regional domains
- **Loading states** and error handling

### ✅ Groups Page (`/dashboard/groups`)
- **View all groups** from database
- **Create new groups** with auto-generated SIP password
- **Edit group** name and description
- **Delete groups** with confirmation
- **Copy SIP passwords** for softphone configuration
- Shows phone number count per group
- **Loading states** and error handling

### ✅ Usage Page (`/dashboard/usage`)
- **Total calls** - All time statistics
- **Total minutes** - Call duration tracking
- **Success rate** - Percentage of successful calls
- **Call breakdown** - Inbound vs Outbound with visual chart
- **Call success** - Successful vs Failed with visual chart
- **Loading states** and error handling

## Common Issues & Solutions

### Issue: 401 Unauthorized
**Solution**: Backend server is not running. Start it with `npm run dev`

### Issue: CORS Error
**Solution**: Check that `client/vite.config.ts` has proper proxy configuration or update `VITE_API_BASE_URL` in `client/.env`

### Issue: Phone numbers not showing
**Causes**:
1. Backend not running → Start backend server
2. No phone numbers in database → Import phone numbers via UI
3. Database schema not applied → Run `database/schema.sql` in Supabase

### Issue: Groups not showing
**Causes**:
1. Backend not running → Start backend server
2. No groups created → Create groups via UI
3. Database schema not applied → Run `database/schema.sql` in Supabase

### Issue: Usage statistics showing 0
**Causes**:
1. No calls made yet → Make some test calls
2. Trigger not working → Check `usage_statistics` table and trigger in Supabase

## API Endpoints Reference

### Phone Numbers
- `GET /api/phone-numbers` - Get all phone numbers
- `POST /api/phone-numbers/import` - Import from Twilio
- `PUT /api/phone-numbers/:id` - Update phone number
- `DELETE /api/phone-numbers/:id` - Delete phone number

### Groups
- `GET /api/groups` - Get all groups
- `POST /api/groups` - Create new group (auto-generates SIP password)
- `PUT /api/groups/:id` - Update group
- `DELETE /api/groups/:id` - Delete group

### Settings & Usage
- `GET /api/settings` - Get user settings
- `PUT /api/settings` - Update user settings
- `GET /api/settings/usage` - Get usage statistics

### Feedback
- `GET /api/feedback` - Get all feedback
- `POST /api/feedback` - Submit new feedback

## Development Workflow

1. **Start Backend**: `cd server && npm run dev`
2. **Start Frontend**: `cd client && npm run dev`
3. **Access App**: http://localhost:5173
4. **Login**: Use Supabase Auth
5. **Navigate**: Dashboard → Telephony/Groups/Usage

## Production Deployment

### Backend
```bash
cd server
npm run build
npm start
```

### Frontend
```bash
cd client
npm run build
# Deploy dist/ folder to your hosting
```

### Environment Variables
Make sure to set all required environment variables in your production environment.

## Next Steps

1. ✅ Run database migration (`database/schema.sql`)
2. ✅ Start backend server
3. ✅ Test phone number import
4. ✅ Create a test group
5. ✅ Make some test calls to see usage statistics

## Need Help?

- **Backend not starting**: Check `server/.env` file exists and has all required variables
- **Database errors**: Verify `database/schema.sql` was executed successfully in Supabase
- **Phone import failing**: Verify Twilio credentials are correct
- **401 errors persist**: Check browser console for detailed error messages

---

**Created**: 2026-01-02
**Status**: Ready for use after running `database/schema.sql` and starting backend server
