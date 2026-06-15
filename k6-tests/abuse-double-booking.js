// ABUSE #1 — Double-booking race
// One student fires create-helcim-checkout 50× in parallel for the same course.
// PASS = exactly 1 booking row + 1 Helcim session created.
// FAIL = multiple bookings, multiple auth holds, refund mess.
//
// Run: k6 run -e BASE_URL=... -e ANON_KEY=... -e STUDENT_TOKEN=... \
//             -e COURSE_ID=... k6-tests/abuse-double-booking.js

import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL;
const ANON_KEY = __ENV.ANON_KEY;
const STUDENT_TOKEN = __ENV.STUDENT_TOKEN; // real student JWT
const COURSE_ID = __ENV.COURSE_ID;         // a published course

const succeededCheckouts = new Counter('checkout_succeeded');
const duplicateAccepted  = new Counter('duplicate_accepted'); // BAD if >1

export const options = {
  scenarios: {
    race: {
      executor: 'per-vu-iterations',
      vus: 50,
      iterations: 1,
      maxDuration: '30s',
    },
  },
  thresholds: {
    // The whole point: at most ONE checkout should succeed.
    'duplicate_accepted': ['count<2'],
  },
};

export default function () {
  const res = http.post(
    `${BASE_URL}/functions/v1/create-helcim-checkout`,
    JSON.stringify({
      course_id: COURSE_ID,
      amount: 10000,
      deposit_amount: 2500,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${STUDENT_TOKEN}`,
      },
      timeout: '20s',
    }
  );

  const ok = check(res, {
    'response received': (r) => r.status > 0,
  });

  if (res.status === 200) {
    succeededCheckouts.add(1);
    duplicateAccepted.add(1);
  }

  console.log(`VU ${__VU}: status=${res.status} body=${res.body?.slice(0, 200)}`);
}

export function teardown() {
  console.log('\n=== Verify in DB ===');
  console.log(`SELECT count(*) FROM bookings WHERE course_id='${COURSE_ID}' AND student_id=<your-student-id>;`);
  console.log(`SELECT count(*) FROM helcim_checkout_sessions WHERE created_at > now() - interval '5 minutes';`);
  console.log('Both should be 1. If higher, you have a race.');
}
