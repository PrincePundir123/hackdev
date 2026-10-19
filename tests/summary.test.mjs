import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, seedDemo, id } from '../server/db.mjs';
import { CareService } from '../server/care.mjs';
import { dailySummary, localDate } from '../server/summary.mjs';
import { createApp } from '../server/app.mjs';

function fixture(t) {
  const db = openDatabase(':memory:');
  let now = Date.parse('2026-10-19T18:40:00Z'); // 20 October, 00:10 in Kolkata.
  seedDemo(db, now);
  db.exec('DELETE FROM reminders');
  const service = new CareService(db, { now: () => now });
  const users = Object.fromEntries(
    db
      .prepare('SELECT * FROM users')
      .all()
      .map((user) => [user.id, user]),
  );
  t.after(() => db.close());
  return {
    db,
    service,
    ...users,
    advance(ms) {
      now += ms;
    },
    now: () => now,
  };
}
test('daily summary uses the household local date and filters completed items by that day', (t) => {
  const f = fixture(t);
  assert.equal(localDate(f.now(), 'Asia/Kolkata'), '2026-10-20');
  assert.equal(localDate(f.now(), 'America/New_York'), '2026-10-19');
  assert.equal(localDate(Date.parse('2026-11-01T06:30:00Z'), 'America/New_York'), '2026-11-01');
  const today = f.service.reminder(f.meera, {
    client_key: id(),
    title: 'Today done',
    trigger_type: 'check_in',
  });
  const yesterday = f.service.reminder(f.meera, {
    client_key: id(),
    title: 'Yesterday done',
    trigger_type: 'check_in',
  });
  f.service.updateReminder(f.meera, today.id, { action: 'complete' });
  f.service.updateReminder(f.meera, yesterday.id, { action: 'complete' });
  f.db
    .prepare('UPDATE reminders SET completed_at=? WHERE id=?')
    .run(f.now() - 20 * 60000, yesterday.id);
  f.service.checkIn(f.meera, { client_key: id() });
  const report = dailySummary(f.service, f.meera);
  assert.equal(report.date, '2026-10-20');
  assert.equal(report.reminders.completed_today, 1);
  assert.equal(report.check_in.received_at, f.now());
  f.advance(24 * 3600000);
  assert.equal(dailySummary(f.service, f.meera).check_in.received_at, null);
});
test('check-in sharing is explicit, defaults private, and revocation or paused participation removes it', (t) => {
  const f = fixture(t);
  f.service.checkIn(f.meera, { client_key: id() });
  assert.equal(
    f.db.prepare("SELECT allow_checkins FROM contacts WHERE user_id='arjun'").get().allow_checkins,
    0,
  );
  assert.deepEqual(dailySummary(f.service, f.arjun).check_in, {
    allowed: false,
    received_at: null,
  });
  const policy = {
    allow_requests: true,
    allow_notes: true,
    allow_reminders: true,
    allow_checkins: true,
    priority: 1,
  };
  f.service.updateContact(f.meera, 'contact-arjun', policy);
  assert.equal(dailySummary(f.service, f.arjun).check_in.received_at, f.now());
  f.service.updateContact(f.meera, 'contact-arjun', { ...policy, allow_checkins: false });
  assert.deepEqual(dailySummary(f.service, f.arjun).check_in, {
    allowed: false,
    received_at: null,
  });
  f.service.updateContact(f.meera, 'contact-arjun', policy);
  f.db.prepare("UPDATE contacts SET accepted=0 WHERE user_id='arjun'").run();
  const paused = dailySummary(f.service, f.arjun);
  assert.equal(paused.check_in.allowed, false);
  assert.equal(paused.reminders.allowed, false);
  assert.equal(paused.requests.allowed, false);
});
test('summary counts are not truncated and restricted views reveal no reminder titles or request details', (t) => {
  const f = fixture(t);
  for (let i = 0; i < 105; i++)
    f.service.reminder(f.meera, {
      client_key: id(),
      title: `Private reminder ${i}`,
      trigger_type: 'check_in',
    });
  f.service.createIncident(f.meera, {
    client_key: id(),
    title: 'Private request',
    private_note: 'Private medical detail',
  });
  f.service.createIncident(f.meera, { client_key: id(), title: 'Practice only' }, true);
  const allowed = dailySummary(f.service, f.arjun);
  assert.equal(allowed.reminders.waiting, 105);
  assert.equal(allowed.requests.open, 1);
  const restricted = dailySummary(f.service, f.leela);
  assert.equal(restricted.reminders.allowed, false);
  assert.equal(restricted.requests.open, 1);
  assert.equal(restricted.requests.items[0].title_is_system, true);
  assert.doesNotMatch(
    JSON.stringify(restricted),
    /Private reminder|Private medical detail|Private request|Practice only/,
  );
  f.db.prepare("UPDATE contacts SET allow_requests=0 WHERE user_id='leela'").run();
  assert.equal(dailySummary(f.service, f.leela).requests.items.length, 0);
});
test('summary separates today’s upcoming reminders, overdue work, resolution and caregiver ownership', (t) => {
  const f = fixture(t);
  const due = f.service.reminder(f.meera, {
    client_key: id(),
    title: 'Overdue',
    trigger_type: 'fixed',
    due_at: f.now() + 60000,
  });
  f.service.reminder(f.meera, {
    client_key: id(),
    title: 'Later today',
    trigger_type: 'fixed',
    due_at: f.now() + 3600000,
  });
  f.service.reminder(f.meera, {
    client_key: id(),
    title: 'Tomorrow',
    trigger_type: 'fixed',
    due_at: f.now() + 24 * 3600000,
  });
  f.db.prepare('UPDATE reminders SET due_at=? WHERE id=?').run(f.now() - 3600000, due.id);
  const request = f.service.createIncident(f.meera, { client_key: id(), title: 'Help today' });
  f.service.respond(f.arjun, request.id, { action: 'accept' });
  assert.equal(dailySummary(f.service, f.arjun).requests.assigned_to_you, 1);
  f.service.respond(f.arjun, request.id, { action: 'resolve', outcome: 'Called and followed up' });
  const report = dailySummary(f.service, f.arjun);
  assert.equal(report.requests.resolved_today, 1);
  assert.equal(report.requests.open, 0);
  assert.equal(report.reminders.due, 1);
  assert.equal(report.reminders.upcoming, 1);
  assert.equal(report.reminders.due_items[0].title, 'Overdue');
});
test('coverage shows only the remaining local day and keeps caregiver plans personal', (t) => {
  const f = fixture(t);
  f.service.updateCoverage(f.arjun, {
    version: 0,
    mode: 'weekly',
    windows: [{ day: 1, start: 60, end: 120 }],
  });
  const personal = dailySummary(f.service, f.arjun).coverage;
  assert.equal(personal.scope, 'personal');
  assert.deepEqual(personal.gaps, [
    { start: 10, end: 60 },
    { start: 120, end: 1440 },
  ]);
  assert.equal(personal.remaining_gap_minutes, 1370);
  assert.equal(dailySummary(f.service, f.meera).coverage.remaining_gap_minutes, 0); // Leela is available.
});
test('daily summary API requires authentication and ignores attempts to select a different household', async (t) => {
  const instance = createApp({ databasePath: ':memory:', demo: true, secureCookie: false });
  instance.finish();
  const server = instance.app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => {
    server.close();
    instance.close();
  });
  const url = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(url + '/api/summary/daily')).status, 401);
  const response = await fetch(url + '/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Saathi-Client': 'web' },
    body: JSON.stringify({
      name: 'Separate home',
      email: 'separate@example.test',
      password: 'LongPassword123!',
    }),
  });
  const cookie = response.headers.get('set-cookie').split(';')[0];
  const report = await fetch(url + '/api/summary/daily?elder_id=meera', {
    headers: { cookie },
  }).then((r) => r.json());
  assert.notEqual(report.elder.id, 'meera');
  assert.equal(report.reminders.waiting, 0);
  assert.equal(report.requests.open, 0);
});
