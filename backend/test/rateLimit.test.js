const test = require('node:test');
const assert = require('node:assert/strict');
const { createRateLimiter } = require('../src/middleware/rateLimit');

function responseStub() {
  return {
    headers: {}, statusCode: 200, body: null,
    set(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('rate limiter allows the configured threshold then returns 429 and Retry-After', async () => {
  let now = 10_000;
  let events = 0;
  const limit = createRateLimiter({ windowMs: 1_000, max: 2, clock: () => now, onLimit: () => { events++; } });
  let nextCount = 0;
  for (let i = 0; i < 2; i++) limit({ ip: 'client-a' }, responseStub(), () => { nextCount++; });
  const blocked = responseStub();
  limit({ ip: 'client-a' }, blocked, () => { nextCount++; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(nextCount, 2);
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.headers['Retry-After'], '1');
  assert.equal(events, 1);
});

test('rate limiter isolates clients and resets after the fixed window', () => {
  let now = 5_000;
  const limit = createRateLimiter({ windowMs: 100, max: 1, clock: () => now, onLimit: () => {} });
  let nextCount = 0;
  const call = (ip) => limit({ ip }, responseStub(), () => { nextCount++; });
  call('a'); call('b');
  call('a');
  now += 101;
  call('a');
  assert.equal(nextCount, 3);
});
