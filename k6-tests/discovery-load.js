import http from 'k6/http';
import { check, sleep, group } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const ANON_KEY = __ENV.ANON_KEY || '';

export const options = {
  stages: [
    { duration: '20s', target: 30 },
    { duration: '1m',  target: 30 },
    { duration: '20s', target: 60 },
    { duration: '20s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1500'],
    http_req_failed:   ['rate<0.02'],
  },
};

export default function () {
  group('Public Pages & Discovery', () => {
    // Homepage (heavy with video, SEO content)
    const home = http.get(`${BASE_URL}/`);
    check(home, {
      'home 200': (r) => r.status === 200,
      'home < 2s': (r) => r.timings.duration < 2000,
    });

    sleep(0.5);

    // Course discovery (Supabase REST call)
    const courses = http.get(
      `${BASE_URL}/rest/v1/courses?select=id,title,discipline,state,city,status&status=eq.published&limit=20`,
      {
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
        },
      }
    );
    check(courses, {
      'courses 200': (r) => r.status === 200,
      'courses JSON': (r) => {
        try { JSON.parse(r.body); return true; } catch { return false; }
      },
      'courses < 800ms': (r) => r.timings.duration < 800,
    });

    sleep(1);

    // Discipline landing pages (SEO routes)
    const disciplines = ['firearms', 'medical', 'tactical-fitness', 'martial-arts'];
    const disc = disciplines[__ITER % disciplines.length];
    const discPage = http.get(`${BASE_URL}/discipline/${disc}`);
    check(discPage, {
      'discipline page 200': (r) => r.status === 200,
    });

    sleep(0.5);

    // State landing
    const states = ['texas', 'florida', 'arizona', 'california'];
    const st = states[__VU % states.length];
    const statePage = http.get(`${BASE_URL}/state/${st}`);
    check(statePage, {
      'state page 200': (r) => r.status === 200,
    });

    sleep(0.5);

    // Blog index
    const blog = http.get(`${BASE_URL}/blog`);
    check(blog, {
      'blog 200': (r) => r.status === 200,
    });

    sleep(1);

    // Public instructor profile
    const instructorProfiles = http.get(
      `${BASE_URL}/rest/v1/profiles?select=id,display_name,slug,bio&account_status=eq.active&role=eq.instructor&limit=10`,
      { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } }
    );
    check(instructorProfiles, {
      'instructor list 200': (r) => r.status === 200,
    });
  });

  sleep(Math.random() * 2 + 1);
}
