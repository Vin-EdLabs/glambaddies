const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'test-admin-secret';

const app = require('../server');

function request(server, method, path, headers = {}) {
  const { port } = server.address();
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, method, path, headers },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () =>
          resolve({ status: res.statusCode, body: JSON.parse(body || '{}') })
        );
      }
    );
    req.on('error', reject);
    req.end();
  });
}

test('app routing and auth guards (no database required)', async (t) => {
  const server = app.listen(0);
  t.after(() => server.close());

  await t.test('health endpoint responds', async () => {
    const res = await request(server, 'GET', '/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
  });

  await t.test('unknown routes return 404 JSON', async () => {
    const res = await request(server, 'GET', '/api/nope');
    assert.equal(res.status, 404);
    assert.ok(res.body.error);
  });

  await t.test('cart requires a customer token', async () => {
    const res = await request(server, 'GET', '/api/cart');
    assert.equal(res.status, 401);
  });

  await t.test('orders require a customer token', async () => {
    const res = await request(server, 'POST', '/api/orders');
    assert.equal(res.status, 401);
  });

  await t.test('admin routes reject missing tokens', async () => {
    const res = await request(server, 'GET', '/api/glam-baddies/dashboard');
    assert.equal(res.status, 401);
  });

  await t.test('customer tokens are rejected on admin routes', async () => {
    const jwt = require('jsonwebtoken');
    const customerToken = jwt.sign(
      { sub: 1, email: 'x@example.com', role: 'customer' },
      process.env.JWT_SECRET
    );
    const res = await request(server, 'GET', '/api/glam-baddies/dashboard', {
      Authorization: `Bearer ${customerToken}`,
    });
    assert.equal(res.status, 401);
  });

  await t.test('admin tokens signed with admin secret are accepted by guard', async () => {
    const jwt = require('jsonwebtoken');
    // Signed with the *customer* secret but role admin -- must fail.
    const forged = jwt.sign(
      { sub: 1, email: 'x@example.com', role: 'admin' },
      process.env.JWT_SECRET
    );
    const res = await request(server, 'GET', '/api/glam-baddies/users', {
      Authorization: `Bearer ${forged}`,
    });
    assert.equal(res.status, 401);
  });
});
