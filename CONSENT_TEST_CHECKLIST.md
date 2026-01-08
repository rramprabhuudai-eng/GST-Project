# Consent Tracking Test Checklist

This checklist ensures the consent tracking implementation works correctly and preserves data integrity.

## Database Migration Tests

### Migration 006_consent_tracking.sql

- [ ] Migration runs successfully on a fresh database
- [ ] Migration is idempotent (can run multiple times without errors)
- [ ] All columns are created with correct types:
  - [ ] `whatsapp_consent` (boolean, default true, NOT NULL)
  - [ ] `opt_out_at` (timestamptz, nullable)
  - [ ] `consent_changed_at` (timestamptz, nullable)
  - [ ] `consent_change_reason` (text, nullable)
- [ ] Index `idx_contacts_consent` is created
- [ ] Trigger `trigger_update_consent_changed_at` is created
- [ ] Function `update_consent_changed_at()` exists
- [ ] NO duplicate columns (claimed_at, claimed_by should NOT be added)

### Trigger Functionality

- [ ] When `whatsapp_consent` changes, `consent_changed_at` is updated automatically
- [ ] When `opt_out_at` changes, `consent_changed_at` is updated automatically
- [ ] When other fields change, `consent_changed_at` is NOT updated
- [ ] Trigger works on both opt-in and opt-out operations

## Opt-Out Functionality Tests

### lib/messaging/opt-out.ts - optOutContact()

#### Contact Update
- [ ] Contact's `whatsapp_consent` is set to `false`
- [ ] Contact's `opt_out_at` is set to current timestamp
- [ ] Contact's `consent_change_reason` is recorded
- [ ] Contact's `consent_changed_at` is updated (via trigger)

#### Reminder Cancellation
- [ ] Reminders with status 'scheduled' are cancelled
- [ ] Reminders with status 'queued' are cancelled
- [ ] Reminders with status 'pending' are cancelled
- [ ] Reminders with status 'sent' are NOT modified
- [ ] Reminders with status 'delivered' are NOT modified
- [ ] Reminders with status 'failed' are NOT modified
- [ ] Reminders with status 'cancelled' are NOT modified
- [ ] Cancelled reminders have `updated_at` timestamp set
- [ ] Function returns correct count of cancelled reminders

#### Message Cancellation
- [ ] Messages with status 'queued' are cancelled
- [ ] Messages with status 'pending' are cancelled
- [ ] Messages with status 'sent' are NOT modified
- [ ] Messages with status 'delivered' are NOT modified
- [ ] Messages with status 'failed' are NOT modified
- [ ] Messages with status 'cancelled' are NOT modified
- [ ] Cancelled messages have `updated_at` timestamp set
- [ ] Function returns correct count of cancelled messages

#### Error Handling
- [ ] Function handles non-existent contact gracefully
- [ ] Function handles database errors gracefully
- [ ] Function returns appropriate error messages

#### Logging
- [ ] Opt-out action is logged with contact ID
- [ ] Counts of cancelled items are logged
- [ ] Reason for opt-out is logged

### lib/messaging/opt-out.ts - optInContact()

- [ ] Contact's `whatsapp_consent` is set to `true`
- [ ] Contact's `opt_out_at` is set to `NULL`
- [ ] Contact's `consent_change_reason` is recorded
- [ ] Contact's `consent_changed_at` is updated (via trigger)
- [ ] Function handles errors gracefully
- [ ] Opt-in action is logged

### lib/messaging/opt-out.ts - hasWhatsAppConsent()

- [ ] Returns `true` when `whatsapp_consent = true` AND `opt_out_at IS NULL`
- [ ] Returns `false` when `whatsapp_consent = false`
- [ ] Returns `false` when `opt_out_at IS NOT NULL`
- [ ] Returns `false` when contact doesn't exist
- [ ] Handles database errors gracefully

## Reminder Scheduling Tests

### lib/reminders/scheduler.ts - scheduleReminder()

#### Consent Checking
- [ ] Checks contact consent BEFORE creating reminder
- [ ] Creates reminder when `whatsapp_consent = true` AND `opt_out_at IS NULL`
- [ ] Does NOT create reminder when `whatsapp_consent = false`
- [ ] Does NOT create reminder when `opt_out_at IS NOT NULL`
- [ ] Returns `skipped: true` when contact has no consent
- [ ] Logs reason when skipping reminder creation

#### Reminder Creation
- [ ] Reminder is created with correct `contact_id`
- [ ] Reminder is created with correct `scheduled_at`
- [ ] Reminder is created with correct `message`
- [ ] Reminder is created with correct `reminder_type`
- [ ] Reminder status is set to 'scheduled'
- [ ] Function returns reminder ID on success

#### Error Handling
- [ ] Handles non-existent contact gracefully
- [ ] Handles database errors gracefully
- [ ] Returns appropriate error messages

### lib/reminders/scheduler.ts - scheduleBulkReminders()

#### Consent Filtering
- [ ] Fetches all contacts before creating reminders
- [ ] Filters contacts by consent (whatsapp_consent = true AND opt_out_at IS NULL)
- [ ] Creates reminders ONLY for contacts with consent
- [ ] Skips contacts without consent
- [ ] Returns correct counts: success, skipped, failed
- [ ] Logs contacts that are skipped with reason

#### Bulk Creation
- [ ] Creates all reminders in a single database operation
- [ ] All reminders have correct data
- [ ] Returns results array with individual statuses
- [ ] Handles partial failures gracefully

## Cron Job Tests

### app/api/cron/send-reminders/route.ts

#### Authorization
- [ ] Requires valid authorization header
- [ ] Returns 401 for invalid/missing auth
- [ ] Checks CRON_SECRET environment variable

#### Reminder Fetching
- [ ] JOINs with contacts table to get consent data
- [ ] Fetches only reminders with status 'scheduled'
- [ ] Fetches only reminders where `scheduled_at <= now`
- [ ] Limits batch size appropriately
- [ ] Handles empty result set gracefully

#### Consent Filtering
- [ ] Checks `whatsapp_consent = true` for each reminder
- [ ] Checks `opt_out_at IS NULL` for each reminder
- [ ] Skips reminders where contact has no consent
- [ ] Cancels skipped reminders (sets status to 'cancelled')
- [ ] Logs each skipped reminder with reason
- [ ] Includes consent values in log message

#### Message Sending
- [ ] Sends messages only to contacts with consent
- [ ] Updates reminder status to 'sent' on success
- [ ] Sets `sent_at` timestamp on success
- [ ] Creates message record in messages table
- [ ] Updates reminder status to 'failed' on error
- [ ] Handles sending errors gracefully

#### Response
- [ ] Returns correct count of processed reminders
- [ ] Returns correct count of sent reminders
- [ ] Returns correct count of skipped reminders
- [ ] Returns individual results array
- [ ] Returns success: true on completion

#### Logging
- [ ] Logs each sent reminder
- [ ] Logs each skipped reminder with reason
- [ ] Logs summary with counts
- [ ] Logs errors appropriately

## Data Integrity Tests

### Historical Data Preservation

- [ ] Opt-out does NOT delete any data
- [ ] Opt-out does NOT modify sent reminders
- [ ] Opt-out does NOT modify delivered reminders
- [ ] Opt-out does NOT modify failed reminders
- [ ] Opt-out does NOT modify sent messages
- [ ] Opt-out does NOT modify delivered messages
- [ ] Opt-out does NOT modify failed messages
- [ ] All historical records remain queryable

### Audit Trail

- [ ] All consent changes have timestamp (`consent_changed_at`)
- [ ] All consent changes can have reason (`consent_change_reason`)
- [ ] Opt-out timestamp is preserved (`opt_out_at`)
- [ ] Can track full consent history for a contact

## End-to-End Scenarios

### Scenario 1: Normal Flow
1. [ ] Contact is created with default consent (whatsapp_consent = true)
2. [ ] Reminder is scheduled for contact
3. [ ] Cron job sends reminder successfully
4. [ ] Message record is created

### Scenario 2: Opt-Out Before Sending
1. [ ] Contact has scheduled reminders
2. [ ] Contact opts out
3. [ ] Scheduled reminders are cancelled
4. [ ] Cron job skips cancelled reminders
5. [ ] No messages are sent

### Scenario 3: Opt-Out After Sending
1. [ ] Reminder is sent successfully
2. [ ] Contact opts out
3. [ ] Sent reminder is NOT modified
4. [ ] Historical data is preserved

### Scenario 4: Opt-Out and Opt-In
1. [ ] Contact opts out
2. [ ] `whatsapp_consent` is false, `opt_out_at` has timestamp
3. [ ] Contact opts back in
4. [ ] `whatsapp_consent` is true, `opt_out_at` is NULL
5. [ ] New reminders can be scheduled

### Scenario 5: Bulk Scheduling with Mixed Consent
1. [ ] Bulk schedule for 10 contacts
2. [ ] 7 contacts have consent, 3 do not
3. [ ] Only 7 reminders are created
4. [ ] 3 are skipped and logged
5. [ ] Response shows correct counts

### Scenario 6: Contact Opts Out Mid-Flight
1. [ ] Reminder is scheduled
2. [ ] Contact opts out before cron runs
3. [ ] Cron job detects no consent via JOIN
4. [ ] Reminder is skipped and cancelled
5. [ ] No message is sent

## Performance Tests

- [ ] Index on (whatsapp_consent, opt_out_at) improves query performance
- [ ] Bulk reminder scheduling is efficient
- [ ] Cron job processes 100+ reminders efficiently
- [ ] JOIN with contacts table doesn't slow down cron significantly

## Edge Cases

- [ ] Contact with NULL whatsapp_consent (shouldn't happen but handle gracefully)
- [ ] Contact with whatsapp_consent = true but opt_out_at set (treat as opted out)
- [ ] Opt-out with no pending reminders
- [ ] Opt-out with large number of pending reminders
- [ ] Concurrent opt-out requests
- [ ] Concurrent reminder scheduling and opt-out
- [ ] Cron job running while opt-out happens

## Security Tests

- [ ] Cron endpoint requires authentication
- [ ] Cannot opt out another user's contact without permission
- [ ] RLS policies respect consent settings (if applicable)
- [ ] Service role key is used for cron operations

## Compliance Tests

- [ ] Opt-out is immediate (no delay)
- [ ] Opt-out cannot be accidentally reversed
- [ ] Consent status is always respected
- [ ] Historical opt-out data is preserved
- [ ] Contact can opt back in at any time

## Documentation Tests

- [ ] Migration file has clear comments
- [ ] opt-out.ts has JSDoc comments explaining critical behavior
- [ ] route.ts has comments about consent checking
- [ ] scheduler.ts has comments about consent checking
- [ ] Critical sections use CRITICAL: prefix in comments
