import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual, createHash, randomUUID } from 'node:crypto';

export const id = () => randomUUID();
export const hashToken = (token) => createHash('sha256').update(token).digest('hex');
export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(password, salt, 64).toString('hex');
}
export function verifyPassword(password, encoded) {
  const [salt, hash] = encoded.split(':');
  const candidate = scryptSync(password, salt, 64);
  return timingSafeEqual(candidate, Buffer.from(hash, 'hex'));
}

export function openDatabase(path = './data/saathi.sqlite') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA foreign_keys=ON;
    PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, household_id TEXT NOT NULL, name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata', is_demo INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY, elder_id TEXT NOT NULL REFERENCES users(id), user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
      relationship TEXT NOT NULL, priority INTEGER NOT NULL, available INTEGER NOT NULL DEFAULT 1,
      accepted INTEGER NOT NULL DEFAULT 1, allow_requests INTEGER NOT NULL DEFAULT 1,
      allow_notes INTEGER NOT NULL DEFAULT 0, allow_reminders INTEGER NOT NULL DEFAULT 0,
      drill_opt_in INTEGER NOT NULL DEFAULT 0, external_opt_in INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS invitations (
      token_hash TEXT PRIMARY KEY, elder_id TEXT NOT NULL REFERENCES users(id), email TEXT NOT NULL,
      relationship TEXT NOT NULL, expires_at INTEGER NOT NULL, used_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS coverage_preferences (
      contact_id TEXT PRIMARY KEY REFERENCES contacts(id) ON DELETE CASCADE,
      mode TEXT NOT NULL CHECK(mode IN ('anytime','weekly')),
      version INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS coverage_windows (
      contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      day INTEGER NOT NULL CHECK(day BETWEEN 0 AND 6),
      start_minute INTEGER NOT NULL CHECK(start_minute BETWEEN 0 AND 1439),
      end_minute INTEGER NOT NULL CHECK(end_minute BETWEEN 1 AND 1440 AND end_minute>start_minute),
      PRIMARY KEY(contact_id,day,start_minute)
    );
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY, elder_id TEXT NOT NULL REFERENCES users(id), client_key TEXT NOT NULL,
      type TEXT NOT NULL, occurred_at INTEGER NOT NULL, received_at INTEGER NOT NULL,
      is_test INTEGER NOT NULL DEFAULT 0, UNIQUE(elder_id, client_key)
    );
    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY, elder_id TEXT NOT NULL REFERENCES users(id), client_key TEXT NOT NULL,
      title TEXT NOT NULL, trigger_type TEXT NOT NULL, offset_minutes INTEGER NOT NULL DEFAULT 0,
      due_at INTEGER, repeat TEXT NOT NULL DEFAULT 'once', status TEXT NOT NULL DEFAULT 'scheduled',
      created_at INTEGER NOT NULL, completed_at INTEGER, last_trigger_day TEXT, delivered_at INTEGER,
      UNIQUE(elder_id, client_key)
    );
    CREATE INDEX IF NOT EXISTS reminders_due ON reminders(status, due_at);
    CREATE TABLE IF NOT EXISTS incidents (
      id TEXT PRIMARY KEY, elder_id TEXT NOT NULL REFERENCES users(id), event_id TEXT UNIQUE NOT NULL REFERENCES events(id),
      title TEXT NOT NULL, private_note TEXT NOT NULL DEFAULT '', state TEXT NOT NULL,
      owner_id TEXT REFERENCES users(id), is_test INTEGER NOT NULL, created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL, next_due_at INTEGER, outcome TEXT, version INTEGER NOT NULL DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS incidents_due ON incidents(state, next_due_at);
    CREATE TABLE IF NOT EXISTS attempts (
      id TEXT PRIMARY KEY, incident_id TEXT NOT NULL REFERENCES incidents(id), contact_id TEXT NOT NULL REFERENCES contacts(id),
      status TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
      UNIQUE(incident_id, contact_id)
    );
    CREATE TABLE IF NOT EXISTS timeline (
      id TEXT PRIMARY KEY, incident_id TEXT NOT NULL REFERENCES incidents(id), kind TEXT NOT NULL,
      text TEXT NOT NULL, created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit (
      id TEXT PRIMARY KEY, elder_id TEXT NOT NULL REFERENCES users(id), actor_id TEXT,
      action TEXT NOT NULL, detail TEXT NOT NULL, decision TEXT NOT NULL, policy_version INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS outbox (
      id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL UNIQUE REFERENCES attempts(id),
      status TEXT NOT NULL DEFAULT 'pending', retries INTEGER NOT NULL DEFAULT 0,
      next_due_at INTEGER NOT NULL, last_error TEXT, updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS outbox_due ON outbox(status, next_due_at);
  `);
  // Existing installations keep all records and receive an English default.
  if (!db.prepare('PRAGMA table_info(users)').all().some((column) => column.name === 'language')) {
    db.exec("ALTER TABLE users ADD COLUMN language TEXT NOT NULL DEFAULT 'en'");
  }
  return db;
}

export function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function seedDemo(db, now = Date.now()) {
  if (db.prepare("SELECT id FROM users WHERE id = 'meera'").get()) return;
  transaction(db, () => {
    const password = hashPassword('SaathiDemo2026!');
    const insert = db.prepare(
      'INSERT INTO users (id,household_id,name,email,password_hash,role,is_demo,created_at) VALUES (?,?,?,?,?,?,1,?)',
    );
    insert.run('meera', 'demo-home', 'Meera Sharma', 'meera@saathi.demo', password, 'elder', now);
    insert.run(
      'arjun',
      'demo-home',
      'Arjun Sharma',
      'arjun@saathi.demo',
      password,
      'caregiver',
      now,
    );
    insert.run('leela', 'demo-home', 'Leela Rao', 'leela@saathi.demo', password, 'caregiver', now);
    const contact = db.prepare(
      'INSERT INTO contacts (id,elder_id,user_id,relationship,priority,allow_notes,allow_reminders,drill_opt_in) VALUES (?,?,?,?,?,?,?,1)',
    );
    contact.run('contact-arjun', 'meera', 'arjun', 'Son', 1, 1, 1);
    contact.run('contact-leela', 'meera', 'leela', 'Neighbour', 2, 0, 0);
    const reminder = db.prepare(
      'INSERT INTO reminders (id,elder_id,client_key,title,trigger_type,offset_minutes,due_at,repeat,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
    );
    reminder.run(
      'seed-water',
      'meera',
      'seed-water',
      'Water the balcony plants',
      'check_in',
      20,
      null,
      'daily',
      'waiting',
      now,
    );
    reminder.run(
      'seed-walk',
      'meera',
      'seed-walk',
      'A little fresh air',
      'fixed',
      0,
      now + 3600000,
      'once',
      'scheduled',
      now,
    );
    db.prepare('INSERT INTO audit VALUES (?,?,?,?,?,?,?,?)').run(
      id(),
      'meera',
      'meera',
      'care_circle_created',
      'Your demo care circle is ready. All people and records are fictional.',
      'allow',
      null,
      now,
    );
  });
}

export function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    timezone: user.timezone,
    language: user.language || 'en',
    is_demo: !!user.is_demo,
  };
}
