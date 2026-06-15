import http from 'k6/http';
import { check, sleep, group } from 'k6';

// Config: set via env vars, e.g.:
// k6 run -e BASE_URL=https://taclink.app -e ANON_KEY=xxx auth-flow.js
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const ANON_KEY = __ENV.ANON_KEY || '';

export const options = {
  stages: [
    { duration: '30s', target: 50 },   // ramp up
    { duration: '1m',  target: 50 },   // steady state
    { duration: '30s', target: 100 },  // stress
    { duration: '30s', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed:   ['rate<0.05'],
    checks:            ['rate>0.95'],
  },
};

function anonHeaders() {
  return {
    'apikey': ANON_KEY,
    'Content-Type': 'application/json',
  };
}

export default function () {
  group('Auth Flow', () => {
    // 1. GET session (most frequent auth call)
    const session = http.get(`${BASE_URL}/auth/v1/user`, {
      headers: anonHeaders(),
    });
    check(session, {
      'session 200/401': (r) => r.status === 200 || r.status === 401,
      'session fast':    (r) => r.timings.duration < 500,
    });

    sleep(1);

    // 2. Signup attempt (measure rate limit / validation latency)
    const payload = JSON.stringify({
      email: `loadtest_${__VU}_${__ITER}@taclink.test`,
      password: 'LoadTest1!',
      options: {
        data: {
          first_name: 'Load',
          last_name: 'Test',
          role: 'student',
          date_of_birth: '1995-06-15',
        },
      },
    });
    const signup = http.post(`${BASE_URL}/auth/v1/signup`, payload, {
      headers: anonHeaders(),
    });
    check(signup, {
      'signup 200 or 422': (r) => r.status === 200 || r.status === 422,
      'signup < 1500ms':   (r) => r.timings.duration < 1500,
    });

    sleep(2);

    // 3. Signin (with fake creds — expect 400, but measures DB lookup speed)
    const signin = http.post(
      `${BASE_URL}/auth/v1/token?grant_type=password`,
      JSON.stringify({
        email: `loadtest_${__VU}_${__ITER}@taclink.test`,
        password: 'WrongPassword123!',
      }),
      { headers: anonHeaders() }
    );
    check(signin, {
      'signin handled': (r) => r.status === 200 || r.status === 400,
      'signin < 1000ms': (r) => r.timings.duration < 1000,
    });
  });

  sleep(Math.random() * 3 + 1);
}
