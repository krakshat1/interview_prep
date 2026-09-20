// Smoke tests for the HTTP API. Runs against a throwaway data folder so it
// never touches your real accounts or sessions. Run with: npm test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'interview-prep-test-'));
for (const f of ['questions', 'codingProblems', 'sqlProblems', 'systemDesignProblems']) {
  fs.copyFileSync(path.join(__dirname, '..', 'data', f + '.json'), path.join(tmp, f + '.json'));
}
process.env.DATA_DIR = tmp;

const app = require('../src/app');
let server;
let base;
let cookie = '';

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = 'http://localhost:' + server.address().port;
});

test.after(() => {
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

async function call(method, url, body) {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  const set = res.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  const text = await res.text();
  return { status: res.status, json: text && res.headers.get('content-type')?.includes('json') ? JSON.parse(text) : null };
}

test('health is public', async () => {
  const r = await call('GET', '/api/health');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.ok, true);
});

test('protected routes require login', async () => {
  const r = await call('GET', '/api/questions');
  assert.strictEqual(r.status, 401);
});

test('signup rejects short passwords', async () => {
  const r = await call('POST', '/api/auth/signup', { email: 'a@b.co', password: 'short' });
  assert.strictEqual(r.status, 400);
});

test('signup, then read the question bank; first account is admin', async () => {
  const s = await call('POST', '/api/auth/signup', { email: 'Admin@Test.dev', password: 'longenough1' });
  assert.strictEqual(s.status, 200);
  assert.strictEqual(s.json.role, 'admin');
  assert.strictEqual(s.json.email, 'admin@test.dev');
  const q = await call('GET', '/api/questions');
  assert.strictEqual(q.status, 200);
  assert.ok(Array.isArray(q.json) && q.json.length > 300);
});

test('duplicate signup is rejected and wrong password fails login', async () => {
  const dup = await call('POST', '/api/auth/signup', { email: 'admin@test.dev', password: 'longenough1' });
  assert.strictEqual(dup.status, 409);
  cookie = '';
  const bad = await call('POST', '/api/auth/login', { email: 'admin@test.dev', password: 'wrongwrong' });
  assert.strictEqual(bad.status, 401);
  const ok = await call('POST', '/api/auth/login', { email: 'admin@test.dev', password: 'longenough1' });
  assert.strictEqual(ok.status, 200);
});
