import { openDatabase, seedDemo, transaction } from '../server/db.mjs';

if (!process.argv.includes('--confirm')) {
  console.log('Stop the app, then run: npm run demo:reset -- --confirm');
  console.log('This resets only the seeded demo household. Other accounts are preserved.');
  process.exit(0);
}
const db = openDatabase(process.env.DATABASE_PATH || './data/saathi.sqlite');
try {
  const meera = db
    .prepare("SELECT id FROM users WHERE id='meera' AND is_demo=1 AND household_id='demo-home'")
    .get();
  if (meera)
    transaction(db, () => {
      db.prepare(
        "DELETE FROM outbox WHERE attempt_id IN (SELECT attempts.id FROM attempts JOIN incidents ON incidents.id=attempts.incident_id WHERE incidents.elder_id='meera')",
      ).run();
      db.prepare(
        "DELETE FROM attempts WHERE incident_id IN (SELECT id FROM incidents WHERE elder_id='meera')",
      ).run();
      db.prepare(
        "DELETE FROM timeline WHERE incident_id IN (SELECT id FROM incidents WHERE elder_id='meera')",
      ).run();
      for (const table of ['incidents', 'events', 'reminders', 'audit', 'invitations', 'contacts'])
        db.prepare(`DELETE FROM ${table} WHERE elder_id='meera'`).run();
      db.prepare(
        "DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE household_id='demo-home')",
      ).run();
      // Accounts joined to the fictional household are part of the demo, never another household.
      db.prepare("DELETE FROM users WHERE household_id='demo-home'").run();
    });
  seedDemo(db);
  console.log('Demo household reset. Real households were not changed.');
} finally {
  db.close();
}
