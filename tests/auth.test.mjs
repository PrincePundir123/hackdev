import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.mjs';

test('authentication uses HTTP-only sessions and enforces request protection', async t => {
  const instance = createApp({ databasePath: ':memory:', demo: true, secureCookie: false });
  instance.finish();
  const server = instance.app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.close(); instance.close(); });
  const url = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body, extra = {}) => fetch(url + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Saathi-Client': 'web', ...extra }, body: JSON.stringify(body) });
  assert.equal((await fetch(url + '/api/auth/me')).status, 401);
  assert.equal((await fetch(url + '/api/auth/demo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"user":"meera"}' })).status, 403);
  const login = await post('/api/auth/demo', { user: 'meera' });
  assert.equal(login.status, 200);
  assert.match(login.headers.get('set-cookie'), /HttpOnly/);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const me = await fetch(url + '/api/auth/me', { headers: { cookie } }).then(r => r.json());
  assert.equal(me.user.role, 'elder');
  assert.equal(me.user.password_hash, undefined);
  await post('/api/auth/logout', {}, { cookie });
  assert.equal((await fetch(url + '/api/auth/me', { headers: { cookie } })).status, 401);
});

test('registration creates isolated homes and demo is unavailable when disabled', async t => {
  const instance = createApp({ databasePath: ':memory:', demo: false, secureCookie: false });
  instance.finish();
  const server = instance.app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.close(); instance.close(); });
  const post = (path, body) => fetch(`http://127.0.0.1:${server.address().port}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Saathi-Client': 'web' }, body: JSON.stringify(body) });
  assert.equal((await post('/api/auth/demo', { user: 'meera' })).status, 404);
  for (const email of ['first@example.test', 'second@example.test']) {
    assert.equal((await post('/api/auth/register', { name: 'New person', email, password: 'StrongPassword123!' })).status, 200);
  }
  const users = instance.db.prepare('SELECT household_id FROM users').all();
  assert.notEqual(users[0].household_id, users[1].household_id);
  assert.equal((await post('/api/auth/login', { email: 'first@example.test', password: 'wrongPassword123' })).status, 401);
});
