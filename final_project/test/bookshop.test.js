const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createApp } = require('../index');
const { createBookClient } = require('../router/general');

test('catalog, async Axios methods, registration, sessions, and review ownership', async (t) => {
  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  async function request(path, { method = 'GET', body, cookie } = {}) {
    const response = await fetch(base + path, {
      method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  const clients = createBookClient(base);
  const [all, isbn, author, title] = await Promise.all([
    clients.getAllBooks(), clients.getBookByISBN('1'), clients.getBooksByAuthor('Unknown'), clients.getBooksByTitle('Things Fall Apart')
  ]);
  assert.equal(Object.keys(all).length, 10);
  assert.equal(isbn.author, 'Chinua Achebe');
  assert.equal(Object.keys(author).length, 4);
  assert.equal(title['1'].title, 'Things Fall Apart');
  await new Promise((resolve, reject) => clients.getAllBooks((error, data) => {
    if (error) return reject(error);
    try { assert.equal(Object.keys(data).length, 10); resolve(); } catch (failure) { reject(failure); }
  }));
  await assert.rejects(clients.getBookByISBN('missing'), (error) => error.response.status === 404);
  assert.equal((await request('/isbn/__proto__')).status, 404);
  assert.deepEqual((await request('/review/1')).data, {});
  assert.equal((await request('/customer/auth/review/1', { method: 'PUT', body: { review: 'Blocked' } })).status, 401);
  const account = (username) => ({ username, password: 'course-demo-only-123' });
  assert.equal((await request('/register', { method: 'POST', body: account('__proto__') })).status, 400);
  const duplicates = await Promise.all([1, 2].map(() => request('/register', { method: 'POST', body: account('reviewer_one') })));
  assert.deepEqual(duplicates.map((r) => r.status).sort(), [201, 409]);
  assert.equal((await request('/register', { method: 'POST', body: account('reviewer_two') })).status, 201);
  assert.equal((await request('/customer/login', { method: 'POST', body: { username: 'reviewer_one', password: 'incorrect' } })).status, 401);
  const one = await request('/customer/login', { method: 'POST', body: account('reviewer_one') });
  const two = await request('/customer/login', { method: 'POST', body: account('reviewer_two') });
  assert.equal(one.status, 200);
  assert.ok(one.cookie);
  assert.equal(two.status, 200);
  await request('/customer/auth/review/1', { method: 'PUT', cookie: one.cookie, body: { review: 'First review' } });
  await request('/customer/auth/review/1', { method: 'PUT', cookie: two.cookie, body: { review: 'Second review', username: 'reviewer_one' } });
  assert.deepEqual((await request('/review/1')).data, { reviewer_one: 'First review', reviewer_two: 'Second review' });
  assert.equal((await request('/customer/auth/review/1', { method: 'PUT', cookie: one.cookie, body: { review: '' } })).status, 400);
  await request('/customer/auth/review/1', { method: 'PUT', cookie: one.cookie, body: { review: 'Updated review' } });
  assert.equal((await request('/review/1')).data.reviewer_one, 'Updated review');
  await request('/customer/auth/review/1?username=reviewer_two', { method: 'DELETE', cookie: one.cookie });
  assert.deepEqual((await request('/review/1')).data, { reviewer_two: 'Second review' });
  assert.equal((await request('/customer/auth/review/1', { method: 'DELETE', cookie: one.cookie })).status, 404);
  assert.equal((await request('/customer/auth/review/404', { method: 'PUT', cookie: two.cookie, body: { review: 'Missing' } })).status, 404);
  assert.equal((await request('/customer/auth/review/1', { method: 'PUT', cookie: 'connect.sid=tampered', body: { review: 'Unauthorized' } })).status, 401);
});
