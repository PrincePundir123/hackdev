import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase, seedDemo, id, hashPassword } from '../server/db.mjs';
import { CareService } from '../server/care.mjs';

function fixture(t, options = {}) {
  const db = openDatabase(options.path || ':memory:');
  let now = Date.parse('2026-10-18T02:30:00Z');
  seedDemo(db, now);
  const service = new CareService(db, { now: () => now, ...options });
  const users = Object.fromEntries(
    db
      .prepare('SELECT * FROM users')
      .all()
      .map((u) => [u.id, u]),
  );
  t.after(() => {
    try {
      db.close();
    } catch {}
  });
  return {
    db,
    service,
    ...users,
    advance: (ms) => {
      now += ms;
      service.tick();
    },
  };
}
function drill(f, key = id()) {
  return f.service.createIncident(
    f.meera,
    {
      client_key: key,
      title: 'Sensitive request',
      private_note: 'DO NOT DISCLOSE: private record',
    },
    true,
  );
}

test('request timeout escalates; acceptance and resolution remain separate', (t) => {
  const f = fixture(t);
  const incident = drill(f);
  assert.equal(incident.attempts[0].user_id, 'arjun');
  f.advance(10001);
  const after = f.service.incident(f.leela, incident.id);
  assert.equal(after.state, 'AWAITING_RESPONSE');
  f.service.respond(f.leela, incident.id, { action: 'accept' });
  assert.equal(f.service.incident(f.leela, incident.id).state, 'ASSIGNED');
  assert.throws(
    () => f.service.respond(f.arjun, incident.id, { action: 'accept' }),
    /expired|already accepted/,
  );
  f.service.respond(f.leela, incident.id, {
    action: 'resolve',
    outcome: 'Called and spoke together.',
  });
  assert.equal(f.service.incident(f.meera, incident.id).state, 'RESOLVED');
});

test('decline immediately hands off to the backup', (t) => {
  const f = fixture(t);
  const incident = drill(f);
  f.service.respond(f.arjun, incident.id, { action: 'decline' });
  assert.equal(
    f.service.view(f.meera, f.service.incident(f.meera, incident.id)).attempts[1].user_id,
    'leela',
  );
});

test('replayed event creates only one request and attempt', (t) => {
  const f = fixture(t);
  const key = id();
  const a = drill(f, key);
  const b = drill(f, key);
  assert.equal(a.id, b.id);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM incidents').get().n, 1);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM attempts').get().n, 1);
});

test('private text never enters restricted views, previews, or shared timelines', (t) => {
  const f = fixture(t);
  const incident = drill(f);
  const view = f.service.view(f.leela, f.service.incident(f.leela, incident.id));
  assert.equal(view.private_note, undefined);
  assert.equal(view.title, 'A check-in has been requested');
  assert.ok(!JSON.stringify(f.service.dashboard(f.leela)).includes('DO NOT DISCLOSE'));
  const preview = f.service.preview(f.meera, 'contact-leela');
  assert.equal(preview.sample.private_note, undefined);
  assert.equal(f.service.dashboard(f.leela).reminders.length, 0);
});

test('revocation blocks reads and acknowledgments and revokes queued disclosure', (t) => {
  const f = fixture(t, { webhook: 'https://example.test/notify' });
  f.db.prepare('UPDATE contacts SET external_opt_in=1 WHERE id=?').run('contact-arjun');
  const incident = f.service.createIncident(f.meera, {
    client_key: id(),
    title: 'Need a check-in',
  });
  f.service.updateContact(f.meera, 'contact-arjun', {
    allow_requests: false,
    allow_notes: false,
    allow_reminders: false,
    priority: 1,
  });
  assert.throws(() => f.service.incident(f.arjun, incident.id), /permission/);
  assert.throws(() => f.service.respond(f.arjun, incident.id, { action: 'accept' }), /permission/);
  assert.equal(f.db.prepare('SELECT status FROM outbox').get().status, 'cancelled');
  assert.equal(f.service.dashboard(f.arjun).incidents.length, 0);
});

test('revoking an assigned responder releases ownership and chooses backup', (t) => {
  const f = fixture(t);
  const incident = drill(f);
  f.service.respond(f.arjun, incident.id, { action: 'accept' });
  f.service.updateContact(f.meera, 'contact-arjun', {
    allow_requests: false,
    allow_notes: false,
    allow_reminders: false,
    priority: 1,
  });
  const latest = f.service.incident(f.meera, incident.id);
  assert.equal(latest.owner_id, null);
  assert.equal(latest.state, 'AWAITING_RESPONSE');
});

test('unrelated household cannot read or respond to an incident', (t) => {
  const f = fixture(t);
  const incident = drill(f);
  const outsider = { ...f.meera, id: 'outsider', household_id: 'other' };
  assert.throws(() => f.service.incident(outsider, incident.id), /permission/);
  assert.throws(() => f.service.respond(outsider, incident.id, { action: 'accept' }), /permission/);
  assert.throws(() => f.service.updateContact(outsider, 'contact-arjun', {}), /not yours/);
});

test('expired invitations and two acceptance attempts never create a second owner', (t) => {
  const f = fixture(t);
  const incident = drill(f);
  f.service.respond(f.arjun, incident.id, { action: 'accept' });
  assert.throws(
    () => f.service.respond(f.arjun, incident.id, { action: 'accept' }),
    /expired|already accepted/,
  );
  assert.throws(
    () => f.service.respond(f.leela, incident.id, { action: 'accept' }),
    /expired|already accepted/,
  );
  assert.equal(f.service.incident(f.meera, incident.id).owner_id, 'arjun');
});

test('no response becomes explicitly unresolved; follow-up timeout hands off', (t) => {
  const f = fixture(t);
  const incident = drill(f);
  f.service.respond(f.arjun, incident.id, { action: 'accept' });
  f.advance(60001);
  assert.equal(f.service.incident(f.meera, incident.id).state, 'FOLLOW_UP_OVERDUE');
  f.advance(15001);
  assert.equal(f.service.incident(f.meera, incident.id).state, 'AWAITING_RESPONSE');
  f.advance(10001);
  assert.equal(f.service.incident(f.meera, incident.id).state, 'NO_RESPONDER');
});

test('check-in reminders deduplicate and repeat at most once per local day', (t) => {
  const f = fixture(t);
  const key = id();
  f.service.checkIn(f.meera, { client_key: key });
  f.service.checkIn(f.meera, { client_key: key });
  assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM events WHERE type='check_in'").get().n, 1);
  f.advance(20 * 60000);
  assert.equal(
    f.db.prepare("SELECT status FROM reminders WHERE id='seed-water'").get().status,
    'due',
  );
  f.service.updateReminder(f.meera, 'seed-water', { action: 'complete' });
  f.service.checkIn(f.meera, { client_key: id() });
  assert.equal(
    f.db.prepare("SELECT status FROM reminders WHERE id='seed-water'").get().status,
    'waiting',
  );
  f.advance(86400000);
  f.service.checkIn(f.meera, { client_key: id() });
  assert.equal(
    f.db.prepare("SELECT status FROM reminders WHERE id='seed-water'").get().status,
    'scheduled',
  );
});

test('fixed reminder persists once, triggers, and supports snooze', (t) => {
  const f = fixture(t);
  const body = {
    client_key: id(),
    title: 'Read a book',
    trigger_type: 'fixed',
    due_at: f.service.now() + 60000,
  };
  const a = f.service.reminder(f.meera, body);
  const b = f.service.reminder(f.meera, body);
  assert.equal(a.id, b.id);
  f.advance(60001);
  assert.equal(f.db.prepare('SELECT status FROM reminders WHERE id=?').get(a.id).status, 'due');
  f.service.updateReminder(f.meera, a.id, { action: 'snooze' });
  assert.equal(
    f.db.prepare('SELECT status FROM reminders WHERE id=?').get(a.id).status,
    'scheduled',
  );
});

test('drills only invite opted-in contacts and never call external providers', async (t) => {
  const f = fixture(t, { webhook: 'https://example.test/notify' });
  f.db.prepare('UPDATE contacts SET drill_opt_in=0,external_opt_in=1').run();
  const incident = drill(f);
  assert.equal(incident.state, 'NO_RESPONDER');
  let sent = 0;
  await f.service.deliver(async () => {
    sent++;
    return { ok: true };
  });
  assert.equal(sent, 0);
});

test('outbound provider failures retry with bounds and preserve the inbox', async (t) => {
  const f = fixture(t, { webhook: 'https://example.test/notify' });
  f.db.prepare('UPDATE contacts SET external_opt_in=1').run();
  const incident = f.service.createIncident(f.meera, {
    client_key: id(),
    title: 'Need help',
    private_note: 'PRIVATE',
  });
  let payload;
  const fail = async (_url, options) => {
    payload = options.body;
    return { ok: false };
  };
  await f.service.deliver(fail);
  f.advance(5001);
  await f.service.deliver(fail);
  f.advance(10001);
  await f.service.deliver(fail);
  assert.equal(f.db.prepare('SELECT status FROM outbox').get().status, 'failed');
  assert.ok(!payload.includes('PRIVATE'));
  assert.equal(f.service.incident(f.arjun, incident.id).state, 'AWAITING_RESPONSE');
});

test('incident deadlines and reminders survive database close and reopen', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'saathi-test-'));
  const path = join(dir, 'test.sqlite');
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const db = openDatabase(path);
  seedDemo(db);
  const service = new CareService(db);
  const meera = db.prepare("SELECT * FROM users WHERE id='meera'").get();
  const incident = service.createIncident(
    meera,
    { client_key: id(), title: 'Restart drill' },
    true,
  );
  db.close();
  const reopened = openDatabase(path);
  try {
    const restored = new CareService(reopened, { now: () => Date.now() + 10001 });
    restored.tick();
    assert.equal(
      restored.get('SELECT COUNT(*) AS n FROM attempts WHERE incident_id=?', incident.id).n,
      2,
    );
    assert.equal(restored.all('SELECT * FROM reminders').length, 2);
  } finally {
    reopened.close();
  }
});
