import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, seedDemo, id } from '../server/db.mjs';
import { CareService } from '../server/care.mjs';
import { normalizeWindows, localPosition, scheduledAt } from '../server/coverage.mjs';

function fixture(t) {
  const db = openDatabase(':memory:');
  let now = Date.parse('2026-10-19T04:00:00Z'); // Monday 09:30 in Kolkata.
  seedDemo(db, now);
  const service = new CareService(db, { now: () => now });
  const users = Object.fromEntries(
    db
      .prepare('SELECT * FROM users')
      .all()
      .map((u) => [u.id, u]),
  );
  t.after(() => db.close());
  return {
    db,
    service,
    ...users,
    advance(ms) {
      now += ms;
      service.tick();
    },
  };
}
function save(f, user, windows, mode = 'weekly', version) {
  const contact = f.db.prepare('SELECT id FROM contacts WHERE user_id=?').get(user.id);
  return f.service.updateCoverage(user, {
    mode,
    windows,
    version: version ?? f.service.plan(contact.id).version,
  });
}
function request(f) {
  return f.service.createIncident(f.meera, { client_key: id(), title: 'Please check in' });
}

test('coverage intervals preserve exact gaps and backup periods in the household timezone', (t) => {
  const f = fixture(t);
  save(f, f.arjun, [{ day: 0, start: 18 * 60, end: 22 * 60 }]);
  save(f, f.leela, [{ day: 0, start: 9 * 60, end: 14 * 60 }]);
  const report = f.service.coverage(f.meera);
  assert.equal(report.timezone, 'Asia/Kolkata');
  assert.deepEqual(report.position, { day: 0, minute: 570 });
  assert.deepEqual(
    report.now.map((c) => c.name),
    ['Leela Rao'],
  );
  assert.deepEqual(
    report.days[0].segments.filter((s) => !s.responders.length).map((s) => [s.start, s.end]),
    [
      [0, 540],
      [840, 1080],
      [1320, 1440],
    ],
  );
  assert.deepEqual(report.next_gap, { day: 0, start: 840, end: 1080 });
  assert.equal(report.days[0].gap_minutes, 900);
  assert.equal(report.days[0].backup_minutes, 0);
  assert.equal(report.days[1].gap_minutes, 1440);
});

test('overlaps are merged and partial backup coverage is counted precisely', (t) => {
  const f = fixture(t);
  save(f, f.arjun, [
    { day: 0, start: 540, end: 720 },
    { day: 0, start: 660, end: 840 },
  ]);
  save(f, f.leela, [{ day: 0, start: 780, end: 900 }]);
  assert.deepEqual(f.service.plan('contact-arjun').windows, [{ day: 0, start: 540, end: 840 }]);
  assert.equal(f.service.coverage(f.meera).days[0].backup_minutes, 60);
  assert.deepEqual(
    normalizeWindows([
      { day: 1, start: 0, end: 600 },
      { day: 0, start: 0, end: 1440 },
      { day: 1, start: 600, end: 1440 },
    ]),
    [
      { day: 0, start: 0, end: 1440 },
      { day: 1, start: 0, end: 1440 },
    ],
  );
});

test('untouched contacts preserve anytime behavior; pauses and sharing permissions remove coverage', (t) => {
  const f = fixture(t);
  assert.equal(f.service.coverage(f.meera).gap_minutes, 0);
  assert.equal(f.service.coverage(f.meera).backup_minutes, 10080);
  f.db.prepare('UPDATE contacts SET available=0 WHERE user_id=?').run('arjun');
  f.db.prepare('UPDATE contacts SET allow_requests=0 WHERE user_id=?').run('leela');
  assert.equal(f.service.coverage(f.meera).gap_minutes, 10080);
  assert.equal(request(f).state, 'NO_RESPONDER');
});

test('routing bypasses off-schedule primary; empty weeks produce no responder', (t) => {
  const f = fixture(t);
  save(f, f.arjun, [{ day: 0, start: 1080, end: 1320 }]);
  const incident = request(f);
  assert.equal(incident.attempts[0].user_id, 'leela');
  assert.ok(incident.timeline.some((e) => e.kind === 'schedule'));
  save(f, f.leela, []);
  assert.equal(request(f).state, 'NO_RESPONDER');
});

test('start is inclusive, end is exclusive, and midnight follows the local weekday', () => {
  const plan = {
    mode: 'weekly',
    windows: [
      { day: 0, start: 540, end: 600 },
      { day: 6, start: 1380, end: 1440 },
    ],
  };
  assert.equal(scheduledAt(plan, { day: 0, minute: 540 }), true);
  assert.equal(scheduledAt(plan, { day: 0, minute: 600 }), false);
  assert.deepEqual(localPosition(Date.parse('2026-10-18T18:30:00Z'), 'Asia/Kolkata'), {
    day: 0,
    minute: 0,
  });
  assert.equal(scheduledAt(plan, { day: 6, minute: 1439 }), true);
  assert.equal(scheduledAt(plan, { day: 0, minute: 0 }), false);
  // Both occurrences of 01:30 during the NY clock change use the same weekly wall-clock rule.
  assert.deepEqual(
    localPosition(Date.parse('2026-11-01T05:30:00Z'), 'America/New_York'),
    localPosition(Date.parse('2026-11-01T06:30:00Z'), 'America/New_York'),
  );
});

test('only the linked caregiver can save hours; stale writes and invalid ranges are rejected', (t) => {
  const f = fixture(t);
  assert.throws(
    () => f.service.updateCoverage(f.meera, { version: 0, mode: 'weekly', windows: [] }),
    /Caregivers/,
  );
  assert.throws(
    () =>
      f.service.updateCoverage(
        { ...f.arjun, id: 'unknown' },
        { version: 0, mode: 'weekly', windows: [] },
      ),
    /not linked/,
  );
  save(f, f.arjun, []);
  assert.throws(() => save(f, f.arjun, [], 'weekly', 0), /another session/);
  assert.throws(() => save(f, f.arjun, [{ day: 0, start: 1320, end: 360 }]), /End time/);
  assert.throws(() => save(f, f.arjun, [{ day: 7, start: 0, end: 1440 }]));
  assert.equal(f.service.plan('contact-arjun').version, 1);
});

test('caregivers see their own schedule, not other people’s weekly availability', (t) => {
  const f = fixture(t);
  const report = f.service.coverage(f.arjun);
  assert.equal(report.scope, 'personal');
  assert.equal(report.contacts.length, 1);
  assert.equal(report.contacts[0].name, 'Arjun Sharma');
  assert.ok(!JSON.stringify(report).includes('Leela'));
  assert.equal(f.service.coverage(f.meera).contacts.length, 2);
});

test('pending invitation hands off at the schedule boundary before its response timeout', (t) => {
  const f = fixture(t);
  save(f, f.arjun, [{ day: 0, start: 570, end: 571 }]);
  const incident = request(f);
  assert.equal(incident.attempts[0].user_id, 'arjun');
  f.advance(60000);
  const latest = f.service.view(f.meera, f.service.incident(f.meera, incident.id));
  assert.equal(latest.attempts[0].status, 'off_schedule');
  assert.equal(latest.attempts[1].user_id, 'leela');
  assert.throws(
    () => f.service.respond(f.arjun, incident.id, { action: 'accept' }),
    /not currently eligible/,
  );
});

test('schedule edits re-evaluate pending invitations, but preserve accepted responsibilities', (t) => {
  const f = fixture(t);
  const pending = request(f);
  save(f, f.arjun, []);
  assert.equal(
    f.service.view(f.meera, f.service.incident(f.meera, pending.id)).attempts.at(-1).user_id,
    'leela',
  );
  save(f, f.arjun, [], 'anytime');
  const assigned = request(f);
  f.service.respond(f.arjun, assigned.id, { action: 'accept' });
  save(f, f.arjun, []);
  f.service.updateContact(f.meera, 'contact-arjun', {
    allow_requests: true,
    allow_notes: false,
    allow_reminders: true,
    priority: 1,
  });
  f.advance(60000);
  assert.equal(f.service.incident(f.arjun, assigned.id).state, 'ASSIGNED');
  assert.equal(f.service.incident(f.arjun, assigned.id).owner_id, 'arjun');
  f.service.respond(f.arjun, assigned.id, {
    action: 'resolve',
    outcome: 'Completed the check-in.',
  });
  assert.equal(f.service.incident(f.meera, assigned.id).state, 'RESOLVED');
});

test('off-schedule contacts do not get external notifications or inflate dashboard coverage', async (t) => {
  const f = fixture(t);
  save(f, f.arjun, []);
  f.service.webhook = 'https://example.test/notify';
  f.db.prepare('UPDATE contacts SET external_opt_in=1 WHERE user_id=?').run('arjun');
  request(f);
  let sends = 0;
  await f.service.deliver(async () => {
    sends++;
    return { ok: true };
  });
  assert.equal(sends, 0);
  assert.deepEqual(
    f.service.dashboard(f.meera).coverage_now.map((c) => c.name),
    ['Leela Rao'],
  );
});
