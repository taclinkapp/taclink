import http from 'k6/http';
import { check, sleep, group } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const ADMIN_TOKEN = __ENV.ADMIN_TOKEN || ''; // JWT of an admin user
const ANON_KEY = __ENV.ANON_KEY || '';

export const options = {
  stages: [
    { duration: '15s', target: 5 },
    { duration: '45s', target: 5 },
    { duration: '15s', target: 10 },
    { duration: '15s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
  },
};

function adminHeaders() {
  return {
    'Content-Type': 'application/json',
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${ADMIN_TOKEN}`,
  };
}

export default function () {
  group('Admin Dashboard APIs', () => {
    // 1. Users list (heaviest admin query)
    const users = http.get(
      `${BASE_URL}/rest/v1/profiles?select=*,user_roles(role)&order=created_at.desc&limit=50`,
      { headers: adminHeaders() }
    );
    check(users, {
      'users 200': (r) => r.status === 200,
      'users < 2s': (r) => r.timings.duration < 2000,
    });

    sleep(1);

    // 2. Audit log
    const audit = http.get(
      `${BASE_URL}/rest/v1/admin_audit_log?select=*&order=created_at.desc&limit=20`,
      { headers: adminHeaders() }
    );
    check(audit, {
      'audit 200': (r) => r.status === 200,
    });

    sleep(1);

    // 3. Courses admin view
    const courses = http.get(
      `${BASE_URL}/rest/v1/courses?select=*&order=created_at.desc&limit=50`,
      { headers: adminHeaders() }
    );
    check(courses, {
      'admin courses 200': (r) => r.status === 200,
    });

    sleep(1);

    // 4. Financials / refunds
    const refunds = http.get(
      `${BASE_URL}/rest/v1/refunds?select=*&order=created_at.desc&limit=20`,
      { headers: adminHeaders() }
    );
    check(refunds, {
      'refunds 200': (r) => r.status === 200,
    });

    sleep(1);

    // 5. Deposit review
    const deposits = http.get(
      `${BASE_URL}/rest/v1/escrow_deposits?select=*&status=eq.pending&limit=20`,
      { headers: adminHeaders() }
    );
    check(deposits, {
      'deposits 200': (r) => r.status === 200,
    });

    sleep(1);

    // 6. Smoke test trigger (admin edge function)
    const smoke = http.post(
      `${BASE_URL}/functions/v1/smoke-test-runner`,
      JSON.stringify({ trigger: 'k6' }),
      { headers: adminHeaders() }
    );
    check(smoke, {
      'smoke test 200/202': (r) => r.status === 200 || r.status === 202,
    });
  });

  sleep(Math.random() * 2 + 1);
}
