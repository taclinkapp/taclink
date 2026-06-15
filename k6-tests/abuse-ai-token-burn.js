// ABUSE #7 — AI assistant token-burn
// Logged-in user fires ai-assistant 500×/min with 30k-token prompts.
// Measures: Lovable AI quota burn, response latency, whether you have ANY
// per-user limit (you don't, per memory note — this just quantifies the damage).
//
// Run: k6 run -e BASE_URL=... -e ANON_KEY=... -e STUDENT_TOKEN=... \
//             k6-tests/abuse-ai-token-burn.js

import http from 'k6/http';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL;
const ANON_KEY = __ENV.ANON_KEY;
const STUDENT_TOKEN = __ENV.STUDENT_TOKEN;

// ~30k token prompt (approx 4 chars/token → 120k chars of filler)
const HUGE_PROMPT = 'Tell me everything about firearms training. '.repeat(2700);

const accepted    = new Counter('ai_request_accepted');
const rejected    = new Counter('ai_request_rejected');
const tokenLatency = new Trend('ai_latency_ms', true);

export const options = {
  scenarios: {
    burn: {
      executor: 'constant-arrival-rate',
      rate: 500,
      timeUnit: '1m',       // 500 req/min
      duration: '2m',       // 1,000 total — enough to feel the bill
      preAllocatedVUs: 50,
      maxVUs: 200,
    },
  },
  thresholds: {
    // If you ever add rate limiting, flip these:
    // 'ai_request_accepted': ['count<100'],
    // For now we just want to see what happens.
    'http_req_failed': ['rate<0.90'],
  },
};

export default function () {
  const t0 = Date.now();
  const res = http.post(
    `${BASE_URL}/functions/v1/ai-assistant`,
    JSON.stringify({
      message: HUGE_PROMPT,
      context: { route: '/abuse-test' },
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${STUDENT_TOKEN}`,
      },
      timeout: '60s',
    }
  );
  tokenLatency.add(Date.now() - t0);

  check(res, { 'response received': (r) => r.status > 0 });

  if (res.status === 200) accepted.add(1);
  else rejected.add(1);

  if (__ITER % 50 === 0) {
    console.log(`progress: status=${res.status} accepted=${accepted.value} rejected=${rejected.value}`);
  }
}

export function teardown() {
  console.log('\n=== What to check ===');
  console.log('1. Lovable AI Gateway usage tab — how many credits did 1,000 huge prompts burn?');
  console.log('2. Edge function logs for ai-assistant — any throttling? Any 429s?');
  console.log('3. If accepted ≈ 1000, you have ZERO protection. Decide:');
  console.log('   - Add per-user daily cap (counter table)');
  console.log('   - Add prompt-length cap (cheap, do this regardless)');
  console.log('   - Require Pro subscription for AI assistant');
}
