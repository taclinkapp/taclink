import http from 'k6/http';
import { check, sleep, group } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const ANON_KEY = __ENV.ANON_KEY || '';

export const options = {
  stages: [
    { duration: '10s', target: 20 },
    { duration: '30s', target: 20 },
    { duration: '10s', target: 40 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1500'],
    http_req_failed:   ['rate<0.01'],
  },
};

export default function () {
  group('Edge Functions & Webhooks', () => {
    // 1. Proximity handshake (high-frequency mobile call)
    const proximityPayload = JSON.stringify({
      token: `test-token-${__VU}-${__ITER}`,
      course_id: '00000000-0000-0000-0000-000000000000',
      lat: 30.2672 + (Math.random() - 0.5) * 0.01,
      lng: -97.7431 + (Math.random() - 0.5) * 0.01,
    });
    const proximity = http.post(
      `${BASE_URL}/functions/v1/proximity-handshake`,
      proximityPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'apikey': ANON_KEY,
        },
      }
    );
    check(proximity, {
      'proximity handled': (r) => r.status === 200 || r.status === 400 || r.status === 401,
      'proximity < 1s': (r) => r.timings.duration < 1000,
    });

    sleep(0.5);

    // 2. AI assistant (if public / low-auth)
    const aiPayload = JSON.stringify({
      message: 'What courses are available in Texas?',
      context: { route: '/discover' },
    });
    const ai = http.post(
      `${BASE_URL}/functions/v1/ai-assistant`,
      aiPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'apikey': ANON_KEY,
        },
      }
    );
    check(ai, {
      'ai 200/429': (r) => r.status === 200 || r.status === 429 || r.status === 400,
    });

    sleep(1);

    // 3. Public blog media (CDN-ish path)
    const media = http.get(`${BASE_URL}/functions/v1/public-blog-media?slug=test`);
    check(media, {
      'blog media 200/404': (r) => r.status === 200 || r.status === 404,
    });

    sleep(0.5);

    // 4. Handle email unsubscribe (no auth required)
    const unsub = http.post(
      `${BASE_URL}/functions/v1/handle-email-unsubscribe`,
      JSON.stringify({ email: `test${__VU}@example.com` }),
      {
        headers: {
          'Content-Type': 'application/json',
          'apikey': ANON_KEY,
        },
      }
    );
    check(unsub, {
      'unsubscribe 200/400': (r) => r.status === 200 || r.status === 400,
    });

    sleep(0.5);

    // 5. Get mapbox token (public, cached)
    const mapbox = http.get(`${BASE_URL}/functions/v1/get-mapbox-token`);
    check(mapbox, {
      'mapbox 200': (r) => r.status === 200,
      'mapbox fast': (r) => r.timings.duration < 500,
    });
  });

  sleep(Math.random() * 2 + 1);
}
