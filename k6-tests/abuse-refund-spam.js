// ABUSE #3 — Refund spam
// Same booking, 1,000 refund calls in parallel.
// PASS = 1 refund processed, 999 rejected as duplicate (idempotency works).
// FAIL = multiple refund rows, Helcim API hammered, audit log bloated.
//
// Run: k6 run -e BASE_URL=... -e ANON_KEY=... -e STUDENT_TOKEN=... \
//             -e BOOKING_ID=... k6-tests/abuse-refund-spam.js

import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL;
const ANON_KEY = __ENV.ANON_KEY;
const STUDENT_TOKEN = __ENV.STUDENT_TOKEN;
const BOOKING_ID = __ENV.BOOKING_ID; // a real booking eligible for refund

const refundAccepted = new Counter('refund_accepted');
const refundRejected = new Counter('refund_rejected');

export const options = {
  scenarios: {
    spam: {
      executor: 'constant-arrival-rate',
      rate: 100,             // 100 req/sec
      timeUnit: '1s',
      duration: '10s',       // 1,000 total requests
      preAllocatedVUs: 50,
      maxVUs: 200,
    },
  },
  thresholds: {
    // Only ONE refund should be accepted.
    'refund_accepted': ['count<2'],
    'http_req_failed': ['rate<0.50'], // expect ~99% rejections, not network failures
  },
};

export default function () {
  const res = http.post(
    `${BASE_URL}/functions/v1/process-refund`,
    JSON.stringify({
      booking_id: BOOKING_ID,
      reason: 'abuse-test',
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${STUDENT_TOKEN}`,
      },
      timeout: '10s',
    }
  );

  check(res, { 'response received': (r) => r.status > 0 });

  if (res.status === 200) refundAccepted.add(1);
  else refundRejected.add(1);
}

export function teardown() {
  console.log('\n=== Verify in DB ===');
  console.log(`SELECT count(*) FROM refunds WHERE booking_id='${BOOKING_ID}';`);
  console.log(`SELECT count(*) FROM admin_audit_log WHERE target_id='${BOOKING_ID}' AND created_at > now() - interval '5 minutes';`);
  console.log('Refund count should be 1. Audit count should be 1 (or 1 + rejected attempts logged).');
}
