import http from 'k6/http';
import { check, sleep, group } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const ANON_KEY = __ENV.ANON_KEY || '';
const SERVICE_ROLE = __ENV.SERVICE_ROLE || ''; // only for seeding in test env

export const options = {
  stages: [
    { duration: '10s', target: 10 },
    { duration: '1m',  target: 10 },
    { duration: '10s', target: 20 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    http_req_failed:   ['rate<0.05'],
  },
};

// Simulates: browse → view course → attempt checkout
export default function () {
  group('Booking Checkout Flow', () => {
    // 1. Fetch published courses
    const coursesRes = http.get(
      `${BASE_URL}/rest/v1/courses?select=id,title,price,deposit_amount,instructor_id,status&status=eq.published&limit=5`,
      { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } }
    );
    check(coursesRes, {
      'fetch courses 200': (r) => r.status === 200,
    });

    let courses = [];
    try { courses = JSON.parse(coursesRes.body); } catch {}
    if (!courses.length) { sleep(2); return; }

    const course = courses[__VU % courses.length];

    sleep(1);

    // 2. Fetch course detail (public view)
    const detail = http.get(
      `${BASE_URL}/rest/v1/courses?select=*,profiles:instructor_id(id,display_name)&id=eq.${course.id}`,
      { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } }
    );
    check(detail, {
      'course detail 200': (r) => r.status === 200,
    });

    sleep(1);

    // 3. Call create-helcim-checkout edge function
    // This is the high-value path — measures Helcim API latency under load
    const checkoutPayload = JSON.stringify({
      course_id: course.id,
      student_email: `loadtest_${__VU}_${__ITER}@taclink.test`,
      amount: course.price || 10000, // cents
      deposit_amount: course.deposit_amount || 2500,
    });
    const checkout = http.post(
      `${BASE_URL}/functions/v1/create-helcim-checkout`,
      checkoutPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'apikey': ANON_KEY,
        },
      }
    );
    check(checkout, {
      'checkout 200 or 400': (r) => r.status === 200 || r.status === 400 || r.status === 422,
      'checkout < 4s': (r) => r.timings.duration < 4000,
    });

    sleep(2);

    // 4. Call create-escrow-checkout (alternative path)
    const escrow = http.post(
      `${BASE_URL}/functions/v1/create-escrow-checkout`,
      checkoutPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'apikey': ANON_KEY,
        },
      }
    );
    check(escrow, {
      'escrow 200/400/422': (r) => r.status === 200 || r.status === 400 || r.status === 422,
    });
  });

  sleep(Math.random() * 3 + 2);
}
