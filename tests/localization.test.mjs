import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openDatabase, publicUser } from '../server/db.mjs';
import languages from '../shared/languages.json' with { type: 'json' };

const english = JSON.parse(
  readFileSync(new URL('../src/locales/en.json', import.meta.url), 'utf8'),
);
const keys = Object.keys(english);
const placeholders = (text) => (text.match(/\{\{\w+\}\}/g) || []).sort();
test('old databases gain a language default without changing accounts or saved records', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'saathi-language-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, 'legacy.sqlite');
  const legacy = new DatabaseSync(path);
  legacy.exec(`CREATE TABLE users (
    id TEXT PRIMARY KEY, household_id TEXT NOT NULL, name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata', is_demo INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  ); INSERT INTO users VALUES ('old','home','Original Name','old@example.test','unchanged','elder','Asia/Kolkata',0,123);`);
  legacy.close();
  let db = openDatabase(path);
  assert.equal(publicUser(db.prepare('SELECT * FROM users').get()).language, 'en');
  db.prepare("UPDATE users SET language='hi' WHERE id='old'").run();
  db.close();
  db = openDatabase(path);
  try {
    const account = db.prepare('SELECT * FROM users').get();
    assert.equal(account.language, 'hi');
    assert.equal(account.name, 'Original Name');
    assert.equal(account.password_hash, 'unchanged');
    assert.equal(account.created_at, 123);
    assert.equal(
      db
        .prepare('PRAGMA table_info(users)')
        .all()
        .filter((column) => column.name === 'language').length,
      1,
    );
  } finally {
    db.close();
  }
});
test('every enabled language has complete text and preserves dynamic values', () => {
  assert.equal(languages.length, 23);
  assert.equal(new Set(languages.map((language) => language.code)).size, 23);
  for (const language of languages.filter((entry) => entry.available && entry.code !== 'en')) {
    const dictionary = JSON.parse(
      readFileSync(new URL(`../src/locales/${language.code}.json`, import.meta.url), 'utf8'),
    );
    assert.equal(Array.isArray(dictionary), false, `${language.code} uses editable source keys`);
    assert.deepEqual(Object.keys(dictionary).sort(), [...keys].sort(), language.code);
    const values = keys.map((key) => dictionary[key]);
    values.forEach((value, i) => {
      assert.equal(typeof value, 'string');
      assert.ok(value.trim(), `${language.code}: ${keys[i]}`);
      assert.deepEqual(placeholders(value), placeholders(keys[i]), `${language.code}: ${keys[i]}`);
    });
    for (const key of [
      'Choose your language',
      'Confirm',
      'Care coverage',
      'My reminders',
      'Personal notes stay in the language they were written in.',
    ]) {
      assert.notEqual(values[keys.indexOf(key)], key, `${language.code} must translate ${key}`);
    }
  }
});
