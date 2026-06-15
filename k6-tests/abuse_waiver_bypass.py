#!/usr/bin/env python3
"""
ABUSE #13 — Waiver bypass

Tests whether the DB actually enforces waiver requirements for contact /
live-fire courses, or whether the UI is the only gatekeeper.

Method: skip the UI entirely. Hit Supabase REST directly with a student JWT
and try to insert a booking row for a course where `waiver_required=true`
WITHOUT first inserting a `waiver_signatures` row.

PASS = REST returns 4xx (RLS policy or trigger blocks it).
FAIL = booking row created → student is on the roster for a live-fire
       course with no signed waiver → you have legal exposure.

Run:
  export BASE_URL=https://<project>.supabase.co
  export ANON_KEY=...
  export STUDENT_TOKEN=...
  export COURSE_ID=<a published course with waiver_required=true>
  python3 k6-tests/abuse_waiver_bypass.py
"""

import os
import sys
import json
import urllib.request
import urllib.error

BASE_URL = os.environ["BASE_URL"].rstrip("/")
ANON_KEY = os.environ["ANON_KEY"]
STUDENT_TOKEN = os.environ["STUDENT_TOKEN"]
COURSE_ID = os.environ["COURSE_ID"]

def post(path: str, body: dict) -> tuple[int, str]:
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=json.dumps(body).encode(),
        headers={
            "Content-Type": "application/json",
            "apikey": ANON_KEY,
            "Authorization": f"Bearer {STUDENT_TOKEN}",
            "Prefer": "return=representation",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

def get(path: str) -> tuple[int, str]:
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        headers={
            "apikey": ANON_KEY,
            "Authorization": f"Bearer {STUDENT_TOKEN}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

print("=" * 60)
print("ABUSE TEST #13 — Waiver bypass")
print("=" * 60)

# 1. Confirm course actually requires waiver
print("\n[1] Verifying target course requires waiver...")
status, body = get(
    f"/rest/v1/courses?select=id,title,waiver_required,discipline&id=eq.{COURSE_ID}"
)
print(f"    GET courses → {status}")
courses = json.loads(body)
if not courses:
    sys.exit(f"FAIL: course {COURSE_ID} not visible to this student.")
course = courses[0]
print(f"    title='{course.get('title')}' discipline='{course.get('discipline')}' "
      f"waiver_required={course.get('waiver_required')}")
if not course.get("waiver_required"):
    sys.exit("SKIP: this course doesn't require a waiver — pick a different COURSE_ID.")

# 2. Attempt direct booking insert without any waiver signature
print("\n[2] Attempting direct booking insert (no waiver signed)...")
status, body = post("/rest/v1/bookings", {
    "course_id": COURSE_ID,
    "status": "confirmed",
    "amount_cents": 10000,
    "deposit_paid_cents": 2500,
})
print(f"    POST bookings → {status}")
print(f"    body: {body[:300]}")

# 3. Verdict
print("\n" + "=" * 60)
if status in (200, 201):
    print("❌ FAIL — Booking created WITHOUT a waiver signature.")
    print("   The DB does not enforce waiver_required. UI toggle is the only gate.")
    print("   Fix: add a trigger on bookings that REJECTS insert if")
    print("        courses.waiver_required=true AND no waiver_signatures row exists")
    print("        for (booking.student_id, booking.course_id).")
    # Clean up
    try:
        inserted = json.loads(body)
        if inserted and isinstance(inserted, list):
            bid = inserted[0].get("id")
            if bid:
                print(f"\n   Created booking id={bid} — DELETE manually:")
                print(f"   DELETE FROM bookings WHERE id='{bid}';")
    except Exception:
        pass
    sys.exit(1)
elif status in (401, 403, 409, 422):
    print(f"✅ PASS — DB rejected the booking ({status}). Waiver enforcement holds.")
    sys.exit(0)
else:
    print(f"⚠️  UNCLEAR — status {status}. Investigate manually.")
    sys.exit(2)
