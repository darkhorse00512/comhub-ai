# Database Migration Checklist

## Status: Ready to Execute

You now have a complete, safe database migration script at `database/schema_safe.sql`.

## Pre-Migration Check

- [x] Backend server is running (confirmed at http://168.119.180.202:3000)
- [x] Initial schema from `database/migrations/001_initial_schema.sql` was executed
- [x] Safe migration script `database/schema_safe.sql` created with DROP IF EXISTS guards

## Migration Steps

1. **Open Supabase SQL Editor**
   - Go to your Supabase project dashboard
   - Navigate to SQL Editor

2. **Run the Safe Migration**
   - Copy the entire contents of `database/schema_safe.sql`
   - Paste into Supabase SQL Editor
   - Click "Run"

3. **Verify Success**
   You should see output indicating tables, policies, triggers, and views were created successfully.

## Post-Migration Verification

### Step 1: Verify Tables Exist
Run this query in Supabase SQL Editor:

```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

Expected tables:
- bulk_call_jobs
- bulk_call_numbers
- call_messages
- call_recordings
- call_sessions
- feedback
- groups
- phone_numbers
- usage_statistics
- user_settings
- users

### Step 2: Verify Views Exist
Run this query:

```sql
SELECT viewname
FROM pg_views
WHERE schemaname = 'public';
```

Expected views:
- call_history_view
- usage_overview

### Step 3: Verify Triggers Exist
Run this query:

```sql
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;
```

Expected triggers:
- update_bulk_call_jobs_updated_at (on bulk_call_jobs)
- update_call_sessions_updated_at (on call_sessions)
- update_feedback_updated_at (on feedback)
- update_groups_updated_at (on groups)
- update_phone_numbers_updated_at (on phone_numbers)
- update_usage_stats_on_call_end (on call_sessions)
- update_user_settings_updated_at (on user_settings)
- update_users_updated_at (on users)

### Step 4: Test Frontend Features

#### Test 1: Telephony Page
1. Navigate to http://localhost:5173/dashboard/telephony
2. Click "Add Phone Number"
3. Click "Import existing number"
4. Enter your Twilio credentials:
   - Account SID
   - Auth Token
   - Phone Number SID
5. Click "Import Number"
6. Verify phone number appears in the list
7. Verify you can copy the phone number
8. Verify you can delete the phone number

#### Test 2: Groups Page
1. Navigate to http://localhost:5173/dashboard/groups
2. Click "Create Group"
3. Enter:
   - Group Name: "Test Group"
   - Description: "Testing group functionality"
4. Click "Create Group"
5. Verify group appears with auto-generated SIP password
6. Verify you can copy the SIP password
7. Verify you can edit the group
8. Verify you can delete the group

#### Test 3: Usage Page
1. Navigate to http://localhost:5173/dashboard/usage
2. Initially, all stats should show 0 (no calls yet)
3. Make a test call using your Twilio number
4. Wait for call to complete
5. Refresh the Usage page
6. Verify statistics update:
   - Total Calls increases
   - Total Minutes shows call duration
   - Success Rate updates
   - Call breakdown shows inbound vs outbound
   - Call success shows successful vs failed

## Troubleshooting

### Issue: Policy already exists error
**Solution**: You're using the safe version which has `DROP POLICY IF EXISTS`. This shouldn't happen.

### Issue: Column already exists error
**Solution**: The script uses `DO $$ BEGIN ... END $$` blocks to check if columns exist before adding. This shouldn't happen.

### Issue: Frontend shows "Error fetching groups/phone numbers"
**Possible causes**:
1. Backend not running → Start with `cd server && npm run dev`
2. JWT token expired → Log out and log back in
3. Database migration not complete → Verify tables exist with queries above

### Issue: Usage statistics not updating
**Possible causes**:
1. Trigger not created → Verify triggers with query above
2. Call status not changing to 'ended' → Check call_sessions table
3. Call missing duration → Verify Twilio is sending duration in webhook

## Migration Safety Features

The `schema_safe.sql` script includes:

1. **Column Existence Checks**: Uses `DO $$ BEGIN ... END $$` blocks to check if columns exist before adding
2. **Safe Policy Creation**: Uses `DROP POLICY IF EXISTS` before creating policies
3. **Safe Trigger Creation**: Uses `DROP TRIGGER IF EXISTS` before creating triggers
4. **Idempotent Tables**: Uses `CREATE TABLE IF NOT EXISTS` for all tables
5. **Conflict Handling**: Uses `ON CONFLICT DO NOTHING` for initial data inserts

This means you can safely run the script multiple times without errors.

## What the Migration Adds

### Enhanced Users Table
- name, company, timezone, updated_at columns

### Enhanced Call Sessions Table
- phone_number_id, group_id, duration, call_quality, disconnect_reason, recording_url, updated_at columns

### New Tables
1. **user_settings**: User preferences for notifications and AI settings
2. **groups**: Organize phone numbers with auto-generated SIP passwords
3. **phone_numbers**: Store Twilio phone numbers with capabilities
4. **bulk_call_jobs**: Manage bulk calling campaigns
5. **bulk_call_numbers**: Track individual numbers in bulk campaigns
6. **feedback**: User feedback and feature requests
7. **usage_statistics**: Aggregated usage metrics per user per day

### Triggers
- Auto-update `updated_at` columns on all tables
- Auto-update usage statistics when calls end

### Views
- **call_history_view**: Enriched call history with phone number and group details
- **usage_overview**: Aggregated usage statistics across all time

## Next Steps After Migration

1. Test phone number import with your Twilio account
2. Create a test group and verify SIP password generation
3. Make test calls to populate usage statistics
4. Explore the dashboard features

## Need Help?

Refer to [BACKEND_SETUP.md](BACKEND_SETUP.md) for:
- Backend server configuration
- API endpoint documentation
- Authentication flow details
- Common troubleshooting steps

---

**Created**: 2026-01-02
**Status**: Ready to execute migration
