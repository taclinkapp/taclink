import http from 'k6/http';
import { check, sleep, group } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const ANON_KEY = __ENV.ANON_KEY || '';

export const options = {
  scenarios: {
    // Simulates instructors checking in students at event start
    checkin_rush: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 30 },   // event starts, rush begins
        { duration: '2m',  target: 30 },   // steady checkins
        { duration: '30s', target: 0 },    // tail off
      ],
      exec: 'checkinRush',
    },
    // Simulates students browsing and booking simultaneously
    booking_burst: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m',  target: 50 },
        { duration: '2m',  target: 50 },
        { duration: '30s', target: 0 },
      ],
      exec: 'bookingBurst',
    },
    // Background: admin monitoring
    admin_monitor: {
      executor: 'constant-vus',
      vus: 3,
      duration: '4m',
      exec: 'adminMonitor',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    http_req_failed:   ['rate<0.05'],
  },
};

export function checkinRush() {
  group('Check-in Rush', () => {
    const payload = JSON.stringify({
      booking_id: `booking-${__VU}-${__ITER}`,
      qr_data: `qr-${__VU}-${__ITER}`,
      lat: 30.2672 + (Math.random() - 0.5) * 0.001,
      lng: -97.7431 + (Math.random() - 0.5) * 0.001,
    });
    const res = http.post(
      `${BASE_URL}/functions/v1/attendance-arbiter`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'apikey': ANON_KEY,
        },
      }
    );
    check(res, {
      'arbiter handled': (r) => r.status === 200 || r.status === 400 || r.status === 401 || r.status === 422,
      'arbiter < 2s': (r) => r.timings.duration < 2000,
    });
  });
  sleep(Math.random() * 2 + 1);
}

export function bookingBurst() {
  group('Booking Burst', () => {
    const courses = http.get(
      `${BASE_URL}/rest/v1/courses?select=id,title,price,deposit_amount&status=eq.published&limit=10`,
      { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } }
    );
    check(courses, { 'courses 200': (r) => r.status === 200 });

    sleep(1);

    const checkoutPayload = JSON.stringify({
      course_id: '00000000-0000-0000-0000-000000000000',
      student_email: `burst${__VU}@taclink.test`,
      amount: 10000,
      deposit_amount: 2500,
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
      'checkout handled': (r) => r.status === 200 || r.status === 400 || r.status === 422,
    });
  });
  sleep(Math.random() * 3 + 2);
}

export function adminMonitor() {
  group('Admin Monitor', () => {
    const users = http.get(
      `${BASE_URL}/rest/v1/profiles?select=id,display_name,account_status&limit=20`,
      { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } }
    );
    check(users, { 'admin users 200': (r) => r.status === 200 });

    sleep(5);

    const audit = http.get(
      `${BASE_URL}/rest/v1/admin_audit_log?select=*&limit=10`,
      { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } }
    );
    check(audit, { 'audit 200': (r) => r.status === 200 });
  });
  sleep(10);
}
