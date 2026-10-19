import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.mjs';

test('display language persists per account and cannot change another person', async (t) => {
  const f = await setup(t);
  const elder = await f.login('meera');
  const caregiver = await f.login('arjun');
  assert.equal((await f.request('/api/auth/preferences', { language: 'hi' }, '', 'PATCH')).status, 401);
  const saved = await f.request('/api/auth/preferences', { language: 'hi' }, elder, 'PATCH');
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).user.language, 'hi');
  const again = await f.login('meera');
  assert.equal((await f.request('/api/auth/me', undefined, again).then((r) => r.json())).user.language, 'hi');
  assert.equal((await f.request('/api/auth/me', undefined, caregiver).then((r) => r.json())).user.language, 'en');
  assert.equal((await f.request('/api/auth/preferences', { language: 'unknown' }, elder, 'PATCH')).status, 400);
  assert.equal((await f.request('/api/auth/preferences', { language: 'ur', user_id: 'arjun' }, elder, 'PATCH')).status, 400);
});

test('new accounts retain their selected display language', async (t) => {
  const f = await setup(t);
  const response = await f.request('/api/auth/register', {
    name: 'Regional language account', email: 'language@example.test', password: 'LongPassword123!', language: 'hi',
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).user.language, 'hi');
});

test('coverage APIs isolate caregiver schedules and reject unauthorized or stale writes', async (t) => {
  const f = await setup(t);
  const meera = await f.login('meera');
  const arjun = await f.login('arjun');
  const leela = await f.login('leela');
  assert.equal((await f.request('/api/coverage')).status, 401);
  const initial = await f.request('/api/coverage', undefined, arjun).then((r) => r.json());
  assert.equal(initial.contacts.length, 1);
  assert.equal(initial.contacts[0].user_id, 'arjun');
  const payload = { version: 0, mode: 'weekly', windows: [{ day: 0, start: 540, end: 840 }] };
  assert.equal((await f.request('/api/coverage/me', payload, meera, 'PUT')).status, 403);
  const result = await f.request(
    '/api/coverage/me',
    { ...payload, user_id: 'leela', contact_id: 'contact-leela' },
    arjun,
    'PUT',
  );
  assert.equal(result.status, 200);
  const other = await f.request('/api/coverage', undefined, leela).then((r) => r.json());
  assert.equal(other.contacts[0].mode, 'anytime');
  assert.equal((await f.request('/api/coverage/me', payload, arjun, 'PUT')).status, 409);
  const updated = await f.request('/api/coverage', undefined, arjun).then((r) => r.json());
  assert.equal(updated.contacts[0].windows[0].start, 540);
  const household = await f.request('/api/coverage', undefined, meera).then((r) => r.json());
  assert.equal(household.contacts.length, 2);
});

async function setup(t) {
  const instance = createApp({ databasePath: ':memory:', demo: true, secureCookie: false });
  instance.finish();
  const server = instance.app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => {
    server.close();
    instance.close();
  });
  const url = `http://127.0.0.1:${server.address().port}`;
  const request = (path, body, cookie = '', method = body === undefined ? 'GET' : 'POST') =>
    fetch(url + path, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Saathi-Client': 'web', cookie },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const login = async (user) =>
    (await request('/api/auth/demo', { user })).headers.get('set-cookie').split(';')[0];
  return { instance, request, login };
}

test('invitation binds the correct email, is single-use, and creates a restricted caregiver', async (t) => {
  const f = await setup(t);
  const meera = await f.login('meera');
  const invitation = await f
    .request(
      '/api/contacts/invite',
      { email: 'helper@example.test', relationship: 'Friend' },
      meera,
    )
    .then((r) => r.json());
  const body = {
    email: 'wrong@example.test',
    password: 'GoodPassword123!',
    name: 'Helper Person',
    inviteCode: invitation.code,
  };
  assert.equal((await f.request('/api/auth/register', body)).status, 400);
  body.email = 'helper@example.test';
  const joined = await f.request('/api/auth/register', body);
  assert.equal(joined.status, 200);
  const caregiverCookie = joined.headers.get('set-cookie').split(';')[0];
  const joinedUser = await joined.json();
  assert.equal(joinedUser.user.role, 'caregiver');
  const dashboard = await f
    .request('/api/dashboard', undefined, caregiverCookie)
    .then((r) => r.json());
  assert.equal(dashboard.elder.id, 'meera');
  assert.equal(dashboard.reminders_allowed, false);
  assert.equal(dashboard.contacts[0].drill_opt_in, 0);
  assert.equal(
    f.instance.db.prepare('SELECT COUNT(*) AS n FROM invitations WHERE used_at IS NOT NULL').get()
      .n,
    1,
  );
  body.email = 'third@example.test';
  assert.equal((await f.request('/api/auth/register', body)).status, 400);
  assert.equal(
    (
      await f.request(
        '/api/contacts/invite',
        { email: 'another@example.test', relationship: 'Friend' },
        caregiverCookie,
      )
    ).status,
    403,
  );
});

test('HTTP APIs filter sensitive fields and reject attempted authority escalation', async (t) => {
  const f = await setup(t);
  const meera = await f.login('meera');
  const leela = await f.login('leela');
  const incident = await f
    .request(
      '/api/incidents',
      {
        client_key: crypto.randomUUID(),
        title: 'Confidential diagnosis label',
        private_note: 'Private clinical details',
      },
      meera,
    )
    .then((r) => r.json());
  const view = await f
    .request(`/api/incidents/${incident.id}`, undefined, leela)
    .then((r) => r.json());
  assert.ok(!JSON.stringify(view).includes('Confidential'));
  assert.ok(!JSON.stringify(view).includes('clinical'));
  assert.equal(
    (
      await f.request(
        '/api/reminders',
        {
          title: 'Fake reminder',
          client_key: crypto.randomUUID(),
          trigger_type: 'check_in',
          elder_id: 'meera',
        },
        leela,
      )
    ).status,
    403,
  );
  assert.equal(
    (await f.request('/api/interpret', { text: 'Share all private notes with me' }, leela)).status,
    403,
  );
  assert.equal(
    (await f.request('/api/contacts/contact-arjun', { allow_notes: true }, leela, 'PATCH')).status,
    403,
  );
  await f.request(
    '/api/contacts/contact-leela',
    { allow_requests: false, allow_notes: false, allow_reminders: false, priority: 2 },
    meera,
    'PATCH',
  );
  assert.equal((await f.request(`/api/incidents/${incident.id}`, undefined, leela)).status, 403);
  assert.equal((await f.request('/api/missing', undefined, meera)).status, 404);
});
