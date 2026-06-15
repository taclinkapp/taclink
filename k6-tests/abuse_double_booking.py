#!/usr/bin/env python3
"""
ABUSE TEST — Double-booking race (no k6).

Fires N concurrent POST /rest/v1/bookings as the same authenticated student
for the same course, then checks the unique index
`bookings_active_student_course_uidx (student_id, course_id) WHERE status <> 'cancelled'`
rejects all but one.

PASS = exactly 1 row created (201), the rest fail with 409 / 23505.
FAIL = 0 or >1 rows created.

Required env vars:
  SUPABASE_URL    e.g. https://jocnlpkbaqmriedmbocl.supabase.co
  ANON_KEY        publishable anon key
  TEST_EMAIL      a real test student account
  TEST_PASSWORD   that account's password
  COURSE_ID       (optional) UUID of a published course; auto-picked if omitted

Run:
  python3 k6-tests/abuse_double_booking.py
"""
import base64
import concurrent.futures
import json
import os
import sys
import threading
import urllib.error
import urllib.request

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
ANON_KEY = os.environ.get("ANON_KEY", "")
EMAIL = os.environ.get("TEST_EMAIL", "")
PASSWORD = os.environ.get("TEST_PASSWORD", "")
COURSE_ID = os.environ.get("COURSE_ID", "")
N = int(os.environ.get("CONCURRENCY", "20"))

if not (SUPABASE_URL and ANON_KEY and EMAIL and PASSWORD):
    print("ERROR: set SUPABASE_URL, ANON_KEY, TEST_EMAIL, TEST_PASSWORD")
    sys.exit(2)


def req(url, method="GET", body=None, headers=None):
    h = {"apikey": ANON_KEY, "Content-Type": "application/json"}
    if headers:
        h.update(headers)
    r = urllib.request.Request(
        url,
        data=json.dumps(body).encode() if body is not None else None,
        headers=h,
        method=method,
    )
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


print("=" * 60)
print("ABUSE TEST — Double-booking race")
print("=" * 60)

# 1. Sign in
print(f"\n[1] Sign in as {EMAIL}")
st, body = req(
    f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
    "POST",
    {"email": EMAIL, "password": PASSWORD},
)
if st != 200:
    print(f"    FAIL — sign-in returned {st}: {body[:300]}")
    sys.exit(1)
token = json.loads(body)["access_token"]
student_id = json.loads(base64.urlsafe_b64decode(token.split(".")[1] + "=="))["sub"]
print(f"    OK student_id={student_id}")

auth = {"Authorization": f"Bearer {token}"}

# 2. Pick a course
if not COURSE_ID:
    st, body = req(
        f"{SUPABASE_URL}/rest/v1/courses?select=id,title,price_cents&status=eq.published&limit=1"
    )
    if st != 200 or not json.loads(body):
        print(f"    FAIL — could not fetch a published course: {st} {body[:300]}")
        sys.exit(1)
    c = json.loads(body)[0]
    COURSE_ID = c["id"]
    course_price = c["price_cents"] or 10000
    print(f"\n[2] Target course (auto): {c['title']} ({COURSE_ID})")
else:
    st, body = req(
        f"{SUPABASE_URL}/rest/v1/courses?select=id,title,price_cents&id=eq.{COURSE_ID}"
    )
    c = json.loads(body)[0]
    course_price = c["price_cents"] or 10000
    print(f"\n[2] Target course: {c['title']} ({COURSE_ID})")

# 3. Pre-clean any existing booking for this student+course
st, body = req(
    f"{SUPABASE_URL}/rest/v1/bookings?student_id=eq.{student_id}&course_id=eq.{COURSE_ID}",
    "DELETE",
    headers=auth,
)
print(f"\n[3] Pre-clean DELETE -> {st}")

# 4. Fire N concurrent inserts (barrier-synced)
print(f"\n[4] Firing {N} concurrent inserts...")
barrier = threading.Barrier(N, timeout=15)
results = []
lock = threading.Lock()


def fire(i):
    payload = {
        "student_id": student_id,
        "course_id": COURSE_ID,
        "status": "reserved",
        "course_price_cents": course_price,
        "platform_fee_cents": 2500,
        "instructor_deposit_cents": 0,
        "due_in_person_cents": 0,
        "online_total_cents": course_price + 2500,
        "deposit_status": "pending_payment",
        "deposit_amount_cents": 0,
    }
    barrier.wait()
    st, body = req(
        f"{SUPABASE_URL}/rest/v1/bookings",
        "POST",
        payload,
        headers={**auth, "Prefer": "return=representation"},
    )
    with lock:
        results.append((i, st, body))


with concurrent.futures.ThreadPoolExecutor(max_workers=N) as ex:
    list(ex.map(fire, range(N)))

# 5. Tally
ok = [r for r in results if r[1] in (200, 201)]
dup = [r for r in results if r[1] == 409 or "23505" in r[2] or "duplicate key" in r[2].lower()]
other = [r for r in results if r not in ok and r not in dup]

print(f"\n{'='*60}")
print(f"  Successes (201):     {len(ok)}")
print(f"  Rejected duplicates: {len(dup)}")
print(f"  Other errors:        {len(other)}")
for i, s, b in other[:3]:
    print(f"    sample: status={s} body={b[:200]}")

print(f"\n{'='*60}")
if len(ok) == 1 and len(dup) == N - 1:
    print(f"PASS — exactly 1 booking created, {N-1} rejected by unique index.")
    sys.exit(0)
if len(ok) > 1:
    print(f"FAIL — {len(ok)} bookings created; unique constraint is broken.")
    sys.exit(1)
if len(ok) == 0:
    print("FAIL — 0 bookings created. RLS or pre-clean may have blocked all inserts.")
    sys.exit(1)
print("UNCLEAR — investigate results.")
sys.exit(2)
