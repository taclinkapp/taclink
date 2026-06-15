import http from 'k6/http';
import { check, sleep, group } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const STUDENT_TOKEN = __ENV.STUDENT_TOKEN || ''; // JWT of a real student user
const ANON_KEY = __ENV.ANON_KEY || '';

export const options = {
  vus: 10,
  duration: '2m',
  thresholds: {
    http_req_duration: ['p(95)<2000'],
  },
};

function authHeaders() {
  return {
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${STUDENT_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

export default function () {
  group('Authenticated Student Journey', () => {
    // 1. My bookings
    const bookings = http.get(
      `${BASE_URL}/rest/v1/bookings?select=*,courses(*)&student_id=eq.me&order=created_at.desc&limit=10`,
      { headers: authHeaders() }
    );
    check(bookings, {
      'bookings 200': (r) => r.status === 200,
      'bookings < 1s': (r) => r.timings.duration < 1000,
    });

    sleep(1);

    // 2. My progress
    const progress = http.get(
      `${BASE_URL}/rest/v1/profiles?select=id,training_goals,completed_courses&me=eq.1`,
      { headers: authHeaders() }
    );
    check(progress, {
      'progress 200': (r) => r.status === 200,
    });

    sleep(1);

    // 3. Messages / inbox
    const messages = http.get(
      `${BASE_URL}/rest/v1/conversations?select=*,messages(count)&participant_ids=cs.{me}&limit=10`,
      { headers: authHeaders() }
    );
    check(messages, {
      'messages 200': (r) => r.status === 200,
    });

    sleep(1);

    // 4. Notifications
    const notifs = http.get(
      `${BASE_URL}/rest/v1/notifications?select=*&user_id=eq.me&is_read=eq.false&limit=20`,
      { headers: authHeaders() }
    );
    check(notifs, {
      'notifications 200': (r) => r.status === 200,
    });

    sleep(1);

    // 5. QR check-in attempt
    const checkinPayload = JSON.stringify({
      booking_id: '00000000-0000-0000-0000-000000000000',
      qr_data: `test-qr-${__VU}-${__ITER}`,
    });
    const checkin = http.post(
      `${BASE_URL}/functions/v1/attendance-arbiter`,
      checkinPayload,
      { headers: authHeaders() }
    );
    check(checkin, {
      'checkin handled': (r) => r.status === 200 || r.status === 400 || r.status === 401 || r.status === 422,
    });
  });

  sleep(Math.random() * 3 + 2);
}
