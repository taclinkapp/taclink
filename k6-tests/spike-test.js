import http from 'k6/http';
import { check, sleep, group } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const ANON_KEY = __ENV.ANON_KEY || '';

export const options = {
  // Spike test: sudden burst of traffic
  stages: [
    { duration: '10s', target: 10 },   // normal
    { duration: '5s',  target: 200 },  // spike
    { duration: '30s', target: 200 },  // sustain spike
    { duration: '5s',  target: 10 },   // recovery
    { duration: '20s', target: 10 },   // verify stable
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'],
    http_req_failed:   ['rate<0.10'], // allow more failures during spike
  },
};

export default function () {
  group('Spike — Course Discovery Burst', () => {
    // All VUs hit the same discovery endpoint simultaneously
    const res = http.get(
      `${BASE_URL}/rest/v1/courses?select=id,title,discipline,state,status&status=eq.published&limit=50`,
      {
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
        },
      }
    );
    check(res, {
      'discovery 200': (r) => r.status === 200,
      'discovery not 500': (r) => r.status !== 500,
    });
  });

  sleep(0.1); // minimal think time for true spike behavior
}
