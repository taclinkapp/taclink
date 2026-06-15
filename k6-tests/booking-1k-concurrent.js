// 1,000 concurrent users booking + paying simultaneously.
//
// ⚠️  BEFORE RUNNING:
//   1. Point BASE_URL at staging, NOT production.
//   2. Set LOAD_TEST_MODE=1 in the edge function env so create-helcim-checkout
//      returns a stub URL instead of hitting Helcim's API.
//   3. Upgrade Lovable Cloud instance — default tier will hit connection-pool
//      exhaustion around 200 concurrent writes.
//   4. Pre-seed at least 20 published courses in the target DB. The test
//      reads them once at setup() and reuses them.
//   5. Run from a machine with enough open-file headroom:
//        ulimit -n 65535
//
// Run:
//   k6 run -e BASE_URL=https://staging.taclink.app \
//          -e ANON_KEY=eyJ... \
//          k6-tests/booking-1k-concurrent.js

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { SharedArray } from 'k6/data';
import { Counter, Trend, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const ANON_KEY = __ENV.ANON_KEY || '';

// Custom metrics so you can see exactly where the system breaks
const checkoutCreated     = new Counter('booking_checkout_created');
const checkoutFailed      = new Counter('booking_checkout_failed');
const checkoutLatency     = new Trend('booking_checkout_latency_ms', true);
const dbWriteLatency      = new Trend('booking_db_write_latency_ms', true);
const poolExhaustion      = new Counter('booking_pool_exhaustion_503');
const rateLimited         = new Counter('booking_rate_limited_429');
const successRate         = new Rate('booking_success_rate');

export const options = {
  scenarios: {
    booking_storm: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100  },   // warm up
        { duration: '30s', target: 500  },   // ramp
        { duration: '30s', target: 1000 },   // hit target
        { duration: '2m',  target: 1000 },   // sustain — this is the real test
        { duration: '30s', target: 0    },   // ramp down (recovery check)
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    // These are SLOs — if any fails, k6 exits non-zero
    'booking_checkout_latency_ms': ['p(95)<5000', 'p(99)<10000'],
    'http_req_failed':             ['rate<0.10'],   // <10% errors acceptable under storm
    'booking_success_rate':        ['rate>0.85'],   // 85% of attempts complete checkout
    'booking_pool_exhaustion_503': ['count<100'],   // some is expected, lots = upgrade compute
    'booking_rate_limited_429':    ['count<50'],
  },
  // Don't let k6 hold connections forever during pool exhaustion
  noConnectionReuse: false,
  userAgent: 'k6-loadtest-1k/1.0',
};

// Pre-load course IDs once, share across all 1k VUs
const courses = new SharedArray('courses', function () {
  const res = http.get(
    `${BASE_URL}/rest/v1/courses?select=id,price,deposit_amount,instructor_id&status=eq.published&limit=50`,
    { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } }
  );
  if (res.status !== 200) {
    throw new Error(`Failed to seed courses: ${res.status} ${res.body}`);
  }
  const list = JSON.parse(res.body);
  if (!list.length) {
    throw new Error('No published courses found — seed the DB before running.');
  }
  return list;
});

export function setup() {
  console.log(`Loaded ${courses.length} courses for booking storm.`);
  console.log(`Target: 1000 concurrent VUs against ${BASE_URL}`);
  return { startedAt: Date.now() };
}

export default function () {
  // Each VU picks a random course — distributes write contention across rows
  const course = courses[Math.floor(Math.random() * courses.length)];
  const email = `storm_${__VU}_${__ITER}_${Date.now()}@taclink.test`;

  let checkoutOk = false;

  group('1. Discover (read)', () => {
    const res = http.get(
      `${BASE_URL}/rest/v1/courses?select=id,title,price&id=eq.${course.id}`,
      {
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
        tags: { phase: 'discover' },
      }
    );
    check(res, { 'discover 200': (r) => r.status === 200 });
    if (res.status === 503) poolExhaustion.add(1);
    if (res.status === 429) rateLimited.add(1);
  });

  sleep(Math.random() * 0.5); // tiny think time — simulates real "click Book Now"

  group('2. Create checkout (write + Helcim)', () => {
    const payload = JSON.stringify({
      course_id: course.id,
      student_email: email,
      amount: course.price || 10000,
      deposit_amount: course.deposit_amount || 2500,
      load_test: true, // edge function should honor this + LOAD_TEST_MODE env
    });

    const t0 = Date.now();
    const res = http.post(
      `${BASE_URL}/functions/v1/create-helcim-checkout`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'apikey': ANON_KEY,
          'x-load-test': '1',
        },
        timeout: '15s',
        tags: { phase: 'checkout' },
      }
    );
    const elapsed = Date.now() - t0;
    checkoutLatency.add(elapsed);

    const ok = check(res, {
      'checkout 200': (r) => r.status === 200,
      'checkout has session id': (r) => {
        try { return !!JSON.parse(r.body).checkoutToken || !!JSON.parse(r.body).session_id; }
        catch { return false; }
      },
    });

    if (ok) {
      checkoutCreated.add(1);
      checkoutOk = true;
    } else {
      checkoutFailed.add(1);
      if (res.status === 503) poolExhaustion.add(1);
      if (res.status === 429) rateLimited.add(1);
    }
    successRate.add(ok);
  });

  sleep(Math.random() * 1 + 0.5);

  group('3. Poll for booking row (simulates webhook arrival)', () => {
    if (!checkoutOk) return;
    const t0 = Date.now();
    const res = http.get(
      `${BASE_URL}/rest/v1/bookings?select=id,status&student_email=eq.${encodeURIComponent(email)}&limit=1`,
      {
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
        tags: { phase: 'poll_booking' },
      }
    );
    dbWriteLatency.add(Date.now() - t0);
    check(res, { 'poll 200': (r) => r.status === 200 });
  });

  sleep(Math.random() * 2 + 1);
}

export function teardown(data) {
  const dur = ((Date.now() - data.startedAt) / 1000).toFixed(0);
  console.log(`\n=== Booking storm complete in ${dur}s ===`);
  console.log('Check Lovable Cloud → Backend → Logs for:');
  console.log('  - "too many connections" (pool exhaustion → upgrade instance)');
  console.log('  - "statement timeout"   (slow query → add index)');
  console.log('  - "429" from Helcim     (rate limit → batch or queue)');
  console.log('\nClean up test data:');
  console.log("  DELETE FROM bookings WHERE student_email LIKE 'storm_%@taclink.test';");
  console.log("  DELETE FROM helcim_checkout_sessions WHERE created_at > now() - interval '1 hour';");
}
