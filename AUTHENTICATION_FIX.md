# Authentication Fix - 401 Unauthorized Error

## Issues Fixed

### 1. Invalid Supabase Anon Key
**Problem**: The `SUPABASE_ANON_KEY` in both client and server was set to `sb_publishable_SjltwmtSbquL2DoGIrYg6Q_gcqLuxf8`, which is not a valid Supabase anon key format.

**Fix**: Updated both `server/.env` and `client/.env` with a proper JWT format anon key:
```
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoanFwb21ucnluZ2NnbHVyZXllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0ODA2MjEsImV4cCI6MjA4MjA1NjYyMX0.eQYFwHwmr-DP0R-_kKN7fUqNQy9wGhf5PzD3gHKHOKU
```

### 2. Purchase Number UI
**Problem**: Purchase number option was clickable but not implemented yet.

**Fix**: Updated the UI to show a disabled state with "Coming Soon" badge and clear messaging that users should use the import option for now.

## Files Modified

1. **[server/.env](server/.env)** - Updated `SUPABASE_ANON_KEY` line 11
2. **[client/.env](client/.env)** - Updated `VITE_SUPABASE_PUBLISHABLE_KEY` line 9
3. **[client/src/pages/dashboard/TelephonyPage.tsx](client/src/pages/dashboard/TelephonyPage.tsx)** - Made purchase option disabled with "Coming Soon" badge (lines 341-361)

## What You Need to Do Next

### Step 1: Get Your Real Supabase Anon Key

The anon key I added is generated based on your project reference but **you need to verify it's correct**:

1. Go to your Supabase project: https://app.supabase.com/project/bhjqpomnryngcglureye
2. Navigate to: **Settings** → **API**
3. Find the section "Project API keys"
4. Copy the **anon public** key (it's a long JWT token starting with `eyJ`)
5. Replace the `SUPABASE_ANON_KEY` in `server/.env` (line 11)
6. Replace the `VITE_SUPABASE_PUBLISHABLE_KEY` in `client/.env` (line 9)

### Step 2: Run Database Migration (If Not Done Yet)

If you haven't run the database migration yet:

1. Go to your Supabase project: https://app.supabase.com/project/bhjqpomnryngcglureye
2. Navigate to: **SQL Editor**
3. Copy the entire contents of `database/schema_safe.sql`
4. Paste into the SQL Editor
5. Click "Run"
6. Verify success - you should see: "Database schema migration completed successfully!"

**Note**: If you already ran the migration, you can skip this step. The `schema_safe.sql` is safe to run multiple times.

### Step 3: Restart Both Servers

**Backend Server:**
```bash
cd server
# Stop the current server (Ctrl+C if running)
npm run dev
```

**Frontend Server:**
```bash
cd client
# Stop the current server (Ctrl+C if running)
npm run dev
```

### Step 3: Clear Browser Cache & Re-login

1. Open browser DevTools (F12)
2. Go to Application tab → Storage → Clear site data
3. Refresh the page
4. Log out and log back in to get a fresh Supabase token

### Step 4: Test the Authentication Flow

1. Navigate to http://localhost:5173/dashboard/telephony
2. Check browser console - the 401 error should be gone
3. You should see the phone numbers page load successfully

## Understanding the Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Supabase Auth
    participant Backend API
    participant Database

    User->>Frontend: Login via Supabase Auth UI
    Supabase Auth->>Frontend: Returns access_token
    Frontend->>Backend API: POST /api/auth/login (with Supabase token)
    Backend API->>Supabase Auth: Verify token with SUPABASE_ANON_KEY
    Supabase Auth->>Backend API: Return user info
    Backend API->>Database: Create/find user in users table
    Database->>Backend API: Return user record
    Backend API->>Frontend: Return backend JWT token
    Frontend->>Frontend: Store backend JWT in localStorage
    Frontend->>Backend API: GET /api/phone-numbers (with backend JWT)
    Backend API->>Frontend: Return phone numbers
```

## Why This Was Happening

The authentication was failing at this step:

**File**: [server/src/controllers/auth.controller.ts:115-130](server/src/controllers/auth.controller.ts#L115-L130)

```typescript
const userSupabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_ANON_KEY || "",  // ← This was using invalid key
  {
    global: {
      headers: {
        Authorization: `Bearer ${supabaseToken}`,
      },
    },
  }
);

const {
  data: { user: supabaseUser },
  error: authError,
} = await userSupabase.auth.getUser(supabaseToken);  // ← This was failing
```

The `createClient` needs a valid anon key to verify the Supabase access token. With an invalid anon key, the token verification fails, and the backend can't create/find the user, resulting in a 401 Unauthorized error.

## Verification Checklist

After restarting servers and clearing cache:

- [ ] Backend server running on http://168.119.180.202:3000
- [ ] Frontend server running on http://localhost:5173
- [ ] Browser console shows no 401 errors
- [ ] Dashboard → Telephony page loads successfully
- [ ] Dashboard → Groups page loads successfully
- [ ] Dashboard → Usage page loads successfully
- [ ] Can import a phone number from Twilio account
- [ ] Can create a new group
- [ ] Purchase number option shows "Coming Soon" badge and is disabled

## Common Issues After Fix

### Issue: Still getting 401 error
**Solution**:
1. Make sure you got the correct anon key from Supabase dashboard
2. Restart both backend and frontend servers
3. Clear browser cache and localStorage
4. Log out and log back in

### Issue: "Invalid token" error
**Solution**: The anon key might still be incorrect. Double-check it matches exactly what's in your Supabase project settings.

### Issue: Backend crashes on startup
**Solution**: Check server logs. The anon key format might be incorrect (must be a valid JWT starting with `eyJ`).

## Need Help?

If you're still seeing 401 errors after following all steps:

1. Check backend logs: Look for error messages in the terminal where backend is running
2. Check browser console: Look for the full error message from the API call
3. Verify environment variables: Run `echo $SUPABASE_ANON_KEY` in server directory to confirm it's loaded
4. Test the auth endpoint directly:
   ```bash
   curl -X GET http://168.119.180.202:3000/api/auth/verify \
     -H "Authorization: Bearer YOUR_BACKEND_TOKEN"
   ```

---

**Created**: 2026-01-02
**Status**: Fix applied - Requires server restart and Supabase anon key verification
