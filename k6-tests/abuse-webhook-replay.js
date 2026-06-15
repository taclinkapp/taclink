// ABUSE #6 — Webhook replay
// Replay the same Helcim webhook payload 500 times.
// PASS = 1 event processed, 499 ignored as duplicate (event_id unique constraint works).
// FAIL = same refund/payment processed multiple times → real money moves twice.
//
// CRITICAL: This bypasses HMAC verification because we're replaying a captured
// signed payload. Capture one from helcim_webhook_events table:
//   SELECT raw_payload, signature_header FROM helcim_webhook_events LIMIT 1;
//
// Run: k6 run -e BASE_URL=... -e WEBHOOK_PAYLOAD_FILE=./payload.json \
//             -e SIGNATURE=... k6-tests/abuse-webhook-replay.js

import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';

const BASE_URL = __ENV.BASE_URL;
const SIGNATURE = __ENV.SIGNATURE || '';
const PAYLOAD_FILE = __ENV.WEBHOOK_PAYLOAD_FILE || './payload.json';

const payload = new SharedArray('payload', () => [open(PAYLOAD_FILE)]);

const accepted = new Counter('webhook_accepted');
const dedupedOrRejected = new Counter('webhook_deduped');

export const options = {
  scenarios: {
    replay: {
      executor: 'constant-arrival-rate',
      rate: 50,
      timeUnit: '1s',
      duration: '10s',     // 500 replays
      preAllocatedVUs: 30,
      maxVUs: 100,
    },
  },
  thresholds: {
    // Only ONE replay should be processed end-to-end.
    'webhook_accepted': ['count<2'],
  },
};

export default function () {
  const res = http.post(
    `${BASE_URL}/functions/v1/pp-webhook`,
    payload[0],
    {
      headers: {
        'Content-Type': 'application/json',
        'webhook-signature': SIGNATURE,
      },
      timeout: '10s',
    }
  );

  check(res, { 'response received': (r) => r.status > 0 });

  // 200 = processed. 409/410/422 = correctly deduped.
  if (res.status === 200) accepted.add(1);
  else dedupedOrRejected.add(1);
}

export function teardown() {
  console.log('\n=== Verify in DB ===');
  console.log(`SELECT count(*) FROM helcim_webhook_events WHERE event_id='<id-from-payload>';`);
  console.log('Should be 1. If higher, your unique constraint on event_id is missing.');
  console.log(`\nIf event was a refund, also check:`);
  console.log(`SELECT count(*) FROM refunds WHERE helcim_transaction_id='<txn-id>';`);
  console.log('Should be 1. If higher, money moved twice.');
}
