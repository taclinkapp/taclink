# Abuse Tests

Five high-priority abuse scenarios. These **detect** vulnerabilities — they do not fix them.

## ⚠️ Before running ANY of these

- **Point at staging, not production.** Several of these create real DB rows, real Helcim auth holds, and real AI Gateway charges.
- **You have no backend rate limiting.** That's a known gap. These tests will reveal where it hurts most so you can prioritize.

## Required env vars (most tests)

```bash
export BASE_URL=https://<project>.supabase.co     # supabase URL, not app URL
export ANON_KEY=eyJ...                            # publishable anon key
export STUDENT_TOKEN=eyJ...                       # JWT of a real test student
```

Get a student JWT by signing in as a test user and reading `localStorage` key `sb-<project>-auth-token` → `access_token`.

---

## #1 — Double-booking race

```bash
export COURSE_ID=<published-course-uuid>
k6 run k6-tests/abuse-double-booking.js
```
**Verify:** exactly 1 row in `bookings` for that (student, course). >1 = race.

## #3 — Refund spam

```bash
export BOOKING_ID=<refund-eligible-booking-uuid>
k6 run k6-tests/abuse-refund-spam.js
```
**Verify:** exactly 1 row in `refunds` for that booking. >1 = money moved twice.

## #6 — Webhook replay

First, capture a real signed payload:
```sql
SELECT raw_payload, signature_header
FROM helcim_webhook_events
ORDER BY created_at DESC LIMIT 1;
```
Save `raw_payload` to `payload.json`, copy `signature_header`, then:
```bash
export WEBHOOK_PAYLOAD_FILE=./payload.json
export SIGNATURE=<signature-header-value>
k6 run k6-tests/abuse-webhook-replay.js
```
**Verify:** `helcim_webhook_events` count for that `event_id` = 1. >1 = no idempotency.

## #7 — AI token burn

```bash
k6 run k6-tests/abuse-ai-token-burn.js
```
**Verify:** Lovable AI usage dashboard. If 1,000 requests succeeded, you have zero protection on `ai-assistant`. Decide on per-user cap, prompt-length cap, or paywall.

## #13 — Waiver bypass

```bash
export COURSE_ID=<course-with-waiver_required=true>
python3 k6-tests/abuse_waiver_bypass.py
```
Exits 0 if DB enforces waivers, 1 if a booking was created without one.

---

## What to do with the results

| Test | If it fails | Fix |
|------|-------------|-----|
| #1   | Multiple bookings | `UNIQUE (course_id, student_id)` on `bookings` + handle `23505` in edge function |
| #3   | Multiple refunds | Idempotency key in `process-refund`; reject if `refunds` row already exists for booking |
| #6   | Replay processed | `UNIQUE (event_id)` on `helcim_webhook_events` + check before processing |
| #7   | All accepted | Per-user daily counter table + cap at N/day; reject prompts >8k chars |
| #13  | Booking created | Trigger on `bookings` blocking insert when `courses.waiver_required=true` and no `waiver_signatures` row exists |
