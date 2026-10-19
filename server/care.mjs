import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { id, hashToken, transaction, publicUser } from './db.mjs';
import { AppError, requireThat } from './auth.mjs';
import { dailySummary } from './summary.mjs';
import {
  coverageSchema,
  coverageReport,
  localPosition,
  normalizeWindows,
  participates,
  scheduledAt,
} from './coverage.mjs';

const terminal = ['RESOLVED', 'CANCELLED', 'NO_RESPONDER'];
const keySchema = z.string().min(8).max(100);
const reminderSchema = z.object({
  client_key: keySchema,
  title: z.string().trim().min(2).max(160),
  trigger_type: z.enum(['fixed', 'check_in']),
  offset_minutes: z.number().int().min(0).max(1440).default(0),
  due_at: z.number().int().nullable().default(null),
  repeat: z.enum(['once', 'daily']).default('once'),
});
const helpSchema = z.object({
  client_key: keySchema,
  title: z.string().trim().min(2).max(160).default('Please check in with me'),
  private_note: z.string().max(1000).default(''),
});

export class CareService {
  constructor(db, options = {}) {
    this.db = db;
    this.now = options.now || Date.now;
    this.webhook = options.webhook || '';
    this.sending = false;
  }
  get(sql, ...args) {
    return this.db.prepare(sql).get(...args);
  }
  all(sql, ...args) {
    return this.db.prepare(sql).all(...args);
  }
  run(sql, ...args) {
    return this.db.prepare(sql).run(...args);
  }
  elder(user) {
    if (user.role === 'elder') return user;
    const link = this.get('SELECT * FROM contacts WHERE user_id=?', user.id);
    requireThat(link, 403, 'You are not linked to a care circle.');
    return this.get('SELECT * FROM users WHERE id=?', link.elder_id);
  }
  requireElder(user) {
    requireThat(user.role === 'elder', 403, 'Only the older adult can change this.');
  }
  audit(elderId, actorId, action, detail, decision = 'allow', version = null) {
    this.run(
      'INSERT INTO audit VALUES (?,?,?,?,?,?,?,?)',
      id(),
      elderId,
      actorId,
      action,
      detail,
      decision,
      version,
      this.now(),
    );
  }
  timeline(incidentId, kind, text) {
    this.run('INSERT INTO timeline VALUES (?,?,?,?,?)', id(), incidentId, kind, text, this.now());
  }
  contacts(elderId) {
    return this.all(
      'SELECT contacts.*,users.name,users.email,users.is_demo FROM contacts JOIN users ON users.id=contacts.user_id WHERE elder_id=? ORDER BY priority,id',
      elderId,
    );
  }
  eligible(contact, incident) {
    return !!(
      contact &&
      contact.accepted &&
      contact.available &&
      contact.allow_requests &&
      this.onSchedule(contact) &&
      (!incident.is_test || contact.drill_opt_in)
    );
  }
  plan(contactId) {
    const preference = this.get('SELECT * FROM coverage_preferences WHERE contact_id=?', contactId);
    return {
      mode: preference?.mode || 'anytime',
      version: preference?.version || 0,
      windows: this.all(
        'SELECT day,start_minute AS start,end_minute AS end FROM coverage_windows WHERE contact_id=? ORDER BY day,start_minute',
        contactId,
      ).map((w) => ({ ...w })),
    };
  }
  onSchedule(contact) {
    if (!contact) return false;
    const elder = this.get('SELECT timezone FROM users WHERE id=?', contact.elder_id);
    return scheduledAt(this.plan(contact.id), localPosition(this.now(), elder.timezone));
  }
  coverage(user) {
    const elder = this.elder(user);
    const scope = user.role === 'elder' ? 'household' : 'personal';
    const contacts = this.contacts(elder.id)
      .filter((c) => scope === 'household' || c.user_id === user.id)
      .map((c) => ({
        id: c.id,
        user_id: c.user_id,
        name: c.name,
        relationship: c.relationship,
        priority: c.priority,
        available: !!c.available,
        accepted: !!c.accepted,
        allow_requests: !!c.allow_requests,
        ...this.plan(c.id),
      }));
    const position = localPosition(this.now(), elder.timezone);
    return {
      scope,
      timezone: elder.timezone,
      generated_at: this.now(),
      position,
      contacts,
      ...coverageReport(contacts, position),
    };
  }
  updateCoverage(user, body) {
    requireThat(user.role === 'caregiver', 403, 'Caregivers set their own scheduled hours.');
    const contact = this.get('SELECT * FROM contacts WHERE user_id=?', user.id);
    requireThat(contact, 403, 'You are not linked to a care circle.');
    const data = coverageSchema.parse(body);
    return transaction(this.db, () => {
      const current = this.plan(contact.id);
      requireThat(
        data.version === current.version,
        409,
        'Your schedule changed in another session. Reload the planner and try again.',
      );
      this.run(
        'INSERT INTO coverage_preferences (contact_id,mode,version,updated_at) VALUES (?,?,?,?) ON CONFLICT(contact_id) DO UPDATE SET mode=excluded.mode,version=excluded.version,updated_at=excluded.updated_at',
        contact.id,
        data.mode,
        current.version + 1,
        this.now(),
      );
      this.run('DELETE FROM coverage_windows WHERE contact_id=?', contact.id);
      const windows = data.mode === 'weekly' ? normalizeWindows(data.windows) : [];
      for (const w of windows)
        this.run(
          'INSERT INTO coverage_windows VALUES (?,?,?,?)',
          contact.id,
          w.day,
          w.start,
          w.end,
        );
      this.audit(
        contact.elder_id,
        user.id,
        'coverage_updated',
        `${user.name} updated their response schedule. Accepted requests keep their assigned caregiver.`,
        'allow',
      );
      this.reconcileCoverage(contact.elder_id);
      return this.coverage(user);
    });
  }
  reconcileCoverage(elderId) {
    const waiting = this.all(
      "SELECT * FROM incidents WHERE state='AWAITING_RESPONSE'" +
        (elderId ? ' AND elder_id=?' : ''),
      ...(elderId ? [elderId] : []),
    );
    for (const incident of waiting) {
      const pending = this.get(
        "SELECT * FROM attempts WHERE incident_id=? AND status='pending'",
        incident.id,
      );
      if (!pending) continue;
      const contact = this.get('SELECT * FROM contacts WHERE id=?', pending.contact_id);
      if (this.eligible(contact, incident)) continue;
      this.run("UPDATE attempts SET status='off_schedule' WHERE id=?", pending.id);
      this.run(
        "UPDATE outbox SET status='cancelled',updated_at=? WHERE attempt_id=? AND status IN ('pending','retry','sending')",
        this.now(),
        pending.id,
      );
      this.timeline(
        incident.id,
        'schedule',
        'The invited contact is no longer scheduled or available. Checking the next eligible contact.',
      );
      this.advance(incident.id);
    }
  }
  canRead(user, incident) {
    if (incident.elder_id === user.id) return true;
    const contact = this.get(
      'SELECT * FROM contacts WHERE user_id=? AND elder_id=?',
      user.id,
      incident.elder_id,
    );
    return !!(
      contact?.accepted &&
      contact.allow_requests &&
      (!incident.is_test || contact.drill_opt_in)
    );
  }
  incident(user, incidentId) {
    const incident = this.get('SELECT * FROM incidents WHERE id=?', incidentId);
    requireThat(incident, 404, 'Request not found.');
    if (!this.canRead(user, incident)) {
      if (
        user.household_id ===
        this.get('SELECT household_id FROM users WHERE id=?', incident.elder_id).household_id
      )
        this.audit(
          incident.elder_id,
          user.id,
          'incident_read',
          'Request access blocked by current permissions.',
          'deny',
        );
      throw new AppError(403, 'You no longer have permission to view this request.');
    }
    return incident;
  }
  view(user, incident) {
    const isOwner = user.id === incident.elder_id;
    const contact = isOwner
      ? null
      : this.get(
          'SELECT * FROM contacts WHERE user_id=? AND elder_id=?',
          user.id,
          incident.elder_id,
        );
    const attempts = this.all(
      'SELECT attempts.*,contacts.user_id,users.name FROM attempts JOIN contacts ON contacts.id=attempts.contact_id JOIN users ON users.id=contacts.user_id WHERE incident_id=? ORDER BY attempts.created_at,attempts.rowid',
      incident.id,
    );
    const result = {
      id: incident.id,
      elder_id: incident.elder_id,
      title: 'A check-in has been requested',
      title_is_system: true,
      outcome_is_system: true,
      state: incident.state,
      owner_id: incident.owner_id,
      owner_name: incident.owner_id
        ? this.get('SELECT name FROM users WHERE id=?', incident.owner_id).name
        : null,
      is_test: !!incident.is_test,
      created_at: incident.created_at,
      updated_at: incident.updated_at,
      next_due_at: incident.next_due_at,
      attempts: attempts.map((a) => ({
        id: a.id,
        name: a.name,
        user_id: a.user_id,
        status: a.status,
        expires_at: a.expires_at,
      })),
      timeline: this.all(
        'SELECT kind,text,created_at FROM timeline WHERE incident_id=? ORDER BY created_at,rowid',
        incident.id,
      ),
      outcome: incident.state === 'RESOLVED' ? 'Follow-up recorded' : null,
    };
    // Free-form request/outcome text is treated as private, since users may put health details in it.
    if (isOwner || contact?.allow_notes)
      Object.assign(result, {
        title: incident.title,
        title_is_system: false,
        outcome_is_system: false,
        private_note: incident.private_note,
        outcome: incident.outcome,
      });
    if (isOwner)
      result.deliveries = this.all(
        'SELECT outbox.status,outbox.retries,outbox.last_error,users.name FROM outbox JOIN attempts ON attempts.id=outbox.attempt_id JOIN contacts ON contacts.id=attempts.contact_id JOIN users ON users.id=contacts.user_id WHERE attempts.incident_id=?',
        incident.id,
      );
    return result;
  }
  dashboard(user) {
    const elder = this.elder(user);
    const own = user.id === elder.id;
    const link = own ? null : this.get('SELECT * FROM contacts WHERE user_id=?', user.id);
    const contacts = this.contacts(elder.id)
      .filter((c) => own || c.user_id === user.id)
      .map((c) => ({ ...c, scheduled_now: this.onSchedule(c) }));
    const permitted = own || (link.accepted && link.allow_reminders);
    const incidents = this.all(
      'SELECT * FROM incidents WHERE elder_id=? ORDER BY created_at DESC LIMIT 100',
      elder.id,
    )
      .filter((i) => this.canRead(user, i))
      .map((i) => this.view(user, i));
    const checkin = own
      ? this.get(
          "SELECT received_at FROM events WHERE elder_id=? AND type='check_in' ORDER BY received_at DESC LIMIT 1",
          elder.id,
        )
      : null;
    return {
      user: publicUser(user),
      elder: { name: elder.name, id: elder.id, timezone: elder.timezone },
      contacts,
      coverage_now: contacts
        .filter((c) => participates(c) && c.scheduled_now)
        .map((c) => ({ id: c.id, name: c.name })),
      reminders: permitted
        ? this.all(
            "SELECT * FROM reminders WHERE elder_id=? ORDER BY CASE status WHEN 'due' THEN 0 WHEN 'scheduled' THEN 1 WHEN 'waiting' THEN 2 ELSE 3 END, due_at LIMIT 100",
            elder.id,
          )
        : [],
      reminders_allowed: !!permitted,
      incidents,
      last_check_in: checkin?.received_at || null,
      audit: own
        ? this.all(
            'SELECT * FROM audit WHERE elder_id=? ORDER BY created_at DESC,rowid DESC LIMIT 80',
            elder.id,
          )
        : [],
      stats: {
        open: incidents.filter((i) => !['RESOLVED', 'CANCELLED'].includes(i.state)).length,
        completed: incidents.filter((i) => i.state === 'RESOLVED').length,
      },
    };
  }
  createInvite(user, body) {
    this.requireElder(user);
    const data = z
      .object({
        email: z
          .string()
          .email()
          .transform((s) => s.trim().toLowerCase()),
        relationship: z.string().trim().min(2).max(50),
      })
      .parse(body);
    requireThat(
      !this.get('SELECT id FROM users WHERE email=?', data.email),
      409,
      'Use a new email address for this invitation. Existing-account linking is not supported.',
    );
    requireThat(
      this.contacts(user.id).length < 8,
      400,
      'Your care circle can have up to eight contacts.',
    );
    const code = randomBytes(24).toString('hex');
    this.run(
      'INSERT INTO invitations VALUES (?,?,?,?,?,NULL)',
      hashToken(code),
      user.id,
      data.email,
      data.relationship,
      this.now() + 3 * 86400000,
    );
    this.audit(
      user.id,
      user.id,
      'contact_invited',
      `An invitation was prepared for ${data.email}.`,
    );
    return { code, email: data.email, expires_at: this.now() + 3 * 86400000 };
  }
  updateContact(user, contactId, body) {
    const contact = this.get('SELECT * FROM contacts WHERE id=?', contactId);
    requireThat(
      contact && (contact.elder_id === user.id || contact.user_id === user.id),
      403,
      'This contact is not yours to update.',
    );
    const schema =
      user.role === 'elder'
        ? z.object({
            allow_requests: z.boolean(),
            allow_notes: z.boolean(),
            allow_reminders: z.boolean(),
            allow_checkins: z.boolean().optional(),
            priority: z.number().int().min(1).max(8),
          })
        : z.object({
            available: z.boolean(),
            accepted: z.boolean(),
            drill_opt_in: z.boolean(),
            external_opt_in: z.boolean(),
          });
    const data = schema.parse(body);
    transaction(this.db, () => {
      const keys = Object.keys(data);
      this.run(
        `UPDATE contacts SET ${keys.map((k) => k + '=?').join(',')},version=version+1 WHERE id=?`,
        ...keys.map((k) => (typeof data[k] === 'boolean' ? Number(data[k]) : data[k])),
        contactId,
      );
      this.audit(
        contact.elder_id,
        user.id,
        'permission_updated',
        user.role === 'elder'
          ? 'Contact sharing permissions updated. Future access uses the new policy.'
          : 'Contact availability and participation updated.',
        'allow',
        contact.version + 1,
      );
      const latest = this.get('SELECT * FROM contacts WHERE id=?', contactId);
      const active = this.all(
        "SELECT incidents.* FROM incidents WHERE elder_id=? AND state NOT IN ('RESOLVED','CANCELLED','NO_RESPONDER')",
        contact.elder_id,
      );
      for (const incident of active) {
        const eligibleForCurrentRequest =
          participates(latest) &&
          (!incident.is_test || latest.drill_opt_in) &&
          (incident.owner_id === latest.user_id || this.onSchedule(latest));
        if (!eligibleForCurrentRequest) {
          this.run(
            "UPDATE attempts SET status='revoked' WHERE contact_id=? AND incident_id=? AND status IN ('pending','accepted')",
            contactId,
            incident.id,
          );
          this.run(
            "UPDATE outbox SET status='cancelled',updated_at=? WHERE status IN ('pending','retry','sending') AND attempt_id IN (SELECT id FROM attempts WHERE contact_id=?)",
            this.now(),
            contactId,
          );
          const pending = this.get(
            "SELECT id FROM attempts WHERE incident_id=? AND status='pending'",
            incident.id,
          );
          if (incident.owner_id === contact.user_id || (!incident.owner_id && !pending)) {
            this.timeline(
              incident.id,
              'policy',
              'The contact is no longer eligible. Checking the next approved contact.',
            );
            this.run('UPDATE incidents SET owner_id=NULL WHERE id=?', incident.id);
            this.advance(incident.id);
          }
        }
      }
    });
    return { ok: true };
  }
  preview(user, contactId) {
    this.requireElder(user);
    const contact = this.get(
      'SELECT * FROM contacts WHERE id=? AND elder_id=?',
      contactId,
      user.id,
    );
    requireThat(contact, 404, 'Contact not found.');
    const person = this.get('SELECT * FROM users WHERE id=?', contact.user_id);
    const sample = this.get(
      'SELECT * FROM incidents WHERE elder_id=? ORDER BY created_at DESC LIMIT 1',
      user.id,
    );
    const request = sample && this.canRead(person, sample) ? this.view(person, sample) : null;
    this.audit(
      user.id,
      user.id,
      'sharing_preview',
      `Reviewed the sharing preview for ${person.name}.`,
      'allow',
      contact.version,
    );
    return {
      name: person.name,
      can_receive: !!(contact.allow_requests && contact.accepted),
      notes: !!contact.allow_notes,
      reminders: !!contact.allow_reminders,
      checkins: !!(contact.accepted && contact.allow_checkins),
      sample: request,
      example:
        contact.allow_requests && contact.accepted
          ? {
              title: contact.allow_notes
                ? 'Please check in with me'
                : 'A check-in has been requested',
              ...(contact.allow_notes
                ? { private_note: 'Private details would be visible to this contact.' }
                : {}),
            }
          : null,
    };
  }
  reminder(user, body) {
    this.requireElder(user);
    const data = reminderSchema.parse(body);
    const previous = this.get(
      'SELECT * FROM reminders WHERE elder_id=? AND client_key=?',
      user.id,
      data.client_key,
    );
    if (previous) return previous;
    requireThat(
      data.trigger_type !== 'fixed' ||
        (data.due_at && data.due_at > this.now() && data.due_at < this.now() + 366 * 86400000),
      400,
      'Choose a reminder time in the coming year.',
    );
    requireThat(
      data.trigger_type !== 'fixed' || data.repeat === 'once',
      400,
      'Daily reminders currently use the morning check-in trigger.',
    );
    const reminderId = id();
    this.run(
      'INSERT INTO reminders (id,elder_id,client_key,title,trigger_type,offset_minutes,due_at,repeat,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
      reminderId,
      user.id,
      data.client_key,
      data.title,
      data.trigger_type,
      data.offset_minutes,
      data.trigger_type === 'fixed' ? data.due_at : null,
      data.repeat,
      data.trigger_type === 'fixed' ? 'scheduled' : 'waiting',
      this.now(),
    );
    this.audit(user.id, user.id, 'reminder_created', 'A confirmed reminder was saved.');
    return this.get('SELECT * FROM reminders WHERE id=?', reminderId);
  }
  updateReminder(user, reminderId, body) {
    this.requireElder(user);
    const action = z.enum(['complete', 'snooze', 'cancel']).parse(body.action);
    const reminder = this.get(
      'SELECT * FROM reminders WHERE id=? AND elder_id=?',
      reminderId,
      user.id,
    );
    requireThat(reminder, 404, 'Reminder not found.');
    requireThat(
      !['completed', 'cancelled'].includes(reminder.status),
      409,
      'This reminder is already closed.',
    );
    if (action === 'snooze')
      this.run(
        "UPDATE reminders SET status='scheduled',due_at=?,delivered_at=NULL WHERE id=?",
        this.now() + 10 * 60000,
        reminderId,
      );
    else if (action === 'complete' && reminder.repeat === 'daily')
      this.run(
        "UPDATE reminders SET status='waiting',due_at=NULL,completed_at=?,delivered_at=NULL WHERE id=?",
        this.now(),
        reminderId,
      );
    else
      this.run(
        'UPDATE reminders SET status=?,completed_at=? WHERE id=?',
        action === 'cancel' ? 'cancelled' : 'completed',
        this.now(),
        reminderId,
      );
    this.audit(
      user.id,
      user.id,
      'reminder_' + action,
      `Reminder ${action === 'complete' ? 'marked done (self-reported)' : action === 'snooze' ? 'snoozed for ten minutes' : 'cancelled'}.`,
    );
    return { ok: true };
  }
  checkIn(user, body) {
    this.requireElder(user);
    const key = keySchema.parse(body.client_key);
    return transaction(this.db, () => {
      const previous = this.get(
        'SELECT * FROM events WHERE elder_id=? AND client_key=?',
        user.id,
        key,
      );
      if (previous) return { ok: true, duplicate: true };
      const now = this.now();
      const day = new Intl.DateTimeFormat('en-CA', { timeZone: user.timezone }).format(
        new Date(now),
      );
      this.run(
        'INSERT INTO events VALUES (?,?,?,?,?,?,0)',
        id(),
        user.id,
        key,
        'check_in',
        now,
        now,
      );
      this.run(
        "UPDATE reminders SET due_at=?+offset_minutes*60000,status='scheduled',last_trigger_day=?,delivered_at=NULL WHERE elder_id=? AND trigger_type='check_in' AND status='waiting' AND (last_trigger_day IS NULL OR last_trigger_day<>?)",
        now,
        day,
        user.id,
        day,
      );
      this.audit(
        user.id,
        user.id,
        'check_in',
        'Morning check-in received. This is a self-reported update.',
      );
      return { ok: true, timestamp: now };
    });
  }
  createIncident(user, body, isTest = false) {
    this.requireElder(user);
    const data = helpSchema.parse(body);
    return transaction(this.db, () => {
      const event = this.get(
        'SELECT * FROM events WHERE elder_id=? AND client_key=?',
        user.id,
        data.client_key,
      );
      if (event) {
        const previous = this.get('SELECT * FROM incidents WHERE event_id=?', event.id);
        requireThat(previous, 409, 'This request key was used for another action.');
        return this.view(user, previous);
      }
      requireThat(
        this.all(
          "SELECT id FROM incidents WHERE elder_id=? AND state NOT IN ('RESOLVED','CANCELLED','NO_RESPONDER')",
          user.id,
        ).length < 5,
        400,
        'Finish an open request before creating another.',
      );
      const now = this.now();
      const eventId = id();
      const incidentId = id();
      this.run(
        'INSERT INTO events VALUES (?,?,?,?,?,?,?)',
        eventId,
        user.id,
        data.client_key,
        isTest ? 'drill' : 'help',
        now,
        now,
        Number(isTest),
      );
      this.run(
        'INSERT INTO incidents (id,elder_id,event_id,title,private_note,state,is_test,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)',
        incidentId,
        user.id,
        eventId,
        data.title,
        data.private_note,
        'CREATED',
        Number(isTest),
        now,
        now,
      );
      this.timeline(
        incidentId,
        'created',
        isTest
          ? 'TEST drill started. No sensor event occurred; only opted-in contacts are eligible.'
          : 'A confirmed support request was created.',
      );
      this.audit(
        user.id,
        user.id,
        isTest ? 'drill_started' : 'help_requested',
        isTest ? 'A synthetic care-circle drill started.' : 'A help request was confirmed.',
      );
      this.advance(incidentId);
      return this.view(user, this.get('SELECT * FROM incidents WHERE id=?', incidentId));
    });
  }
  advance(incidentId) {
    const incident = this.get('SELECT * FROM incidents WHERE id=?', incidentId);
    if (!incident || terminal.includes(incident.state)) return;
    const tried = new Set(
      this.all('SELECT contact_id FROM attempts WHERE incident_id=?', incidentId).map(
        (a) => a.contact_id,
      ),
    );
    const contacts = this.contacts(incident.elder_id);
    const outsideSchedule = contacts.filter(
      (c) =>
        !tried.has(c.id) &&
        participates(c) &&
        (!incident.is_test || c.drill_opt_in) &&
        !this.onSchedule(c),
    );
    if (outsideSchedule.length)
      this.timeline(
        incidentId,
        'schedule',
        outsideSchedule.length === 1
          ? 'One otherwise eligible contact is outside scheduled hours and will not be invited now.'
          : `${outsideSchedule.length} otherwise eligible contacts are outside scheduled hours and will not be invited now.`,
      );
    const next = contacts.find((c) => !tried.has(c.id) && this.eligible(c, incident));
    const now = this.now();
    if (!next) {
      this.run(
        "UPDATE incidents SET state='NO_RESPONDER',owner_id=NULL,next_due_at=NULL,updated_at=?,version=version+1 WHERE id=?",
        now,
        incidentId,
      );
      this.timeline(
        incidentId,
        'unanswered',
        'No responder confirmed. Use your agreed manual contact plan.',
      );
      return;
    }
    const attemptId = id();
    const due = now + (incident.is_test ? 10000 : 120000);
    this.run(
      "INSERT INTO attempts VALUES (?,?,?,'pending',?,?)",
      attemptId,
      incidentId,
      next.id,
      now,
      due,
    );
    this.run(
      "UPDATE incidents SET state='AWAITING_RESPONSE',owner_id=NULL,next_due_at=?,updated_at=?,version=version+1 WHERE id=?",
      due,
      now,
      incidentId,
    );
    this.timeline(
      incidentId,
      'invited',
      `${next.name} was invited in their caregiver inbox. Waiting for acceptance.`,
    );
    this.audit(
      incident.elder_id,
      next.user_id,
      'request_shared',
      next.allow_notes
        ? `A permitted detailed request was placed in ${next.name}’s inbox.`
        : `A minimal request was placed in ${next.name}’s inbox.`,
      'allow',
      next.version,
    );
    if (this.webhook && next.external_opt_in && !incident.is_test)
      this.run(
        "INSERT INTO outbox (id,attempt_id,status,next_due_at,updated_at) VALUES (?,?,'pending',?,?)",
        id(),
        attemptId,
        now,
        now,
      );
  }
  respond(user, incidentId, body) {
    const action = z.enum(['accept', 'decline', 'resolve', 'cancel']).parse(body.action);
    const outcome = z
      .string()
      .trim()
      .max(500)
      .parse(body.outcome || '');
    return transaction(this.db, () => {
      const incident = this.incident(user, incidentId);
      requireThat(!terminal.includes(incident.state), 409, 'This request has already closed.');
      if (action === 'cancel') {
        requireThat(user.id === incident.elder_id, 403, 'Only the requester can cancel.');
        this.run(
          "UPDATE incidents SET state='CANCELLED',next_due_at=NULL,updated_at=?,version=version+1 WHERE id=?",
          this.now(),
          incidentId,
        );
        this.run(
          "UPDATE attempts SET status='cancelled' WHERE incident_id=? AND status='pending'",
          incidentId,
        );
        this.timeline(incidentId, 'cancelled', 'The older adult cancelled this request.');
      } else if (action === 'resolve') {
        requireThat(
          incident.owner_id === user.id || (incident.elder_id === user.id && incident.owner_id),
          403,
          'Only the assigned caregiver or requester can record the outcome of an assigned request.',
        );
        requireThat(outcome.length >= 3, 400, 'Please record a short outcome.');
        this.run(
          "UPDATE incidents SET state='RESOLVED',outcome=?,next_due_at=NULL,updated_at=?,version=version+1 WHERE id=?",
          outcome,
          this.now(),
          incidentId,
        );
        this.timeline(
          incidentId,
          'resolved',
          'Follow-up was recorded and the request was resolved.',
        );
      } else {
        const contact = this.get(
          'SELECT * FROM contacts WHERE user_id=? AND elder_id=?',
          user.id,
          incident.elder_id,
        );
        requireThat(
          this.eligible(contact, incident),
          403,
          'You are not currently eligible to respond.',
        );
        const attempt = this.get(
          "SELECT * FROM attempts WHERE incident_id=? AND contact_id=? AND status='pending'",
          incidentId,
          contact.id,
        );
        requireThat(
          attempt &&
            attempt.expires_at > this.now() &&
            !incident.owner_id &&
            incident.state === 'AWAITING_RESPONSE',
          409,
          'This invitation expired or another person already accepted.',
        );
        this.run(
          'UPDATE attempts SET status=? WHERE id=?',
          action === 'accept' ? 'accepted' : 'declined',
          attempt.id,
        );
        if (action === 'accept') {
          this.run(
            "UPDATE incidents SET state='ASSIGNED',owner_id=?,next_due_at=?,updated_at=?,version=version+1 WHERE id=? AND owner_id IS NULL",
            user.id,
            this.now() + (incident.is_test ? 60000 : 1800000),
            this.now(),
            incidentId,
          );
          this.timeline(
            incidentId,
            'accepted',
            `${user.name} accepted responsibility. An outcome is still needed.`,
          );
        } else {
          this.timeline(
            incidentId,
            'declined',
            `${user.name} could not respond. Checking the next contact.`,
          );
          this.advance(incidentId);
        }
      }
      this.audit(
        incident.elder_id,
        user.id,
        'request_' + action,
        `Request action recorded: ${action}.`,
      );
      return this.view(user, this.get('SELECT * FROM incidents WHERE id=?', incidentId));
    });
  }
  tick() {
    transaction(this.db, () => {
      const now = this.now();
      this.reconcileCoverage();
      for (const reminder of this.all(
        "SELECT * FROM reminders WHERE status='scheduled' AND due_at<=?",
        now,
      )) {
        this.run(
          "UPDATE reminders SET status='due',delivered_at=? WHERE id=? AND status='scheduled'",
          now,
          reminder.id,
        );
        this.audit(
          reminder.elder_id,
          null,
          'reminder_due',
          'A reminder is now available in the personal inbox.',
        );
      }
      for (const incident of this.all('SELECT * FROM incidents WHERE next_due_at<=?', now)) {
        if (incident.state === 'AWAITING_RESPONSE') {
          this.run(
            "UPDATE attempts SET status='expired' WHERE incident_id=? AND status='pending'",
            incident.id,
          );
          this.timeline(
            incident.id,
            'timeout',
            'The response window expired without an acceptance.',
          );
          this.advance(incident.id);
        } else if (incident.state === 'ASSIGNED') {
          this.run(
            "UPDATE incidents SET state='FOLLOW_UP_OVERDUE',next_due_at=?,updated_at=?,version=version+1 WHERE id=?",
            now + (incident.is_test ? 15000 : 300000),
            now,
            incident.id,
          );
          this.timeline(
            incident.id,
            'overdue',
            'A response was accepted, but follow-up is overdue. The owner can still record an outcome.',
          );
        } else if (incident.state === 'FOLLOW_UP_OVERDUE') {
          this.timeline(
            incident.id,
            'handoff',
            'No follow-up was recorded. Releasing ownership and checking an approved backup.',
          );
          this.run(
            "UPDATE attempts SET status='follow_up_expired' WHERE incident_id=? AND status='accepted'",
            incident.id,
          );
          this.run('UPDATE incidents SET owner_id=NULL WHERE id=?', incident.id);
          this.advance(incident.id);
        }
      }
      this.run('DELETE FROM sessions WHERE expires_at<?', now);
    });
  }
  async deliver(fetchImpl = fetch) {
    if (!this.webhook || this.sending) return;
    this.sending = true;
    try {
      const jobs = this.all(
        "SELECT * FROM outbox WHERE status IN ('pending','retry','sending') AND next_due_at<=? LIMIT 5",
        this.now(),
      );
      for (const job of jobs) {
        const attempt = this.get('SELECT * FROM attempts WHERE id=?', job.attempt_id);
        const incident = this.get('SELECT * FROM incidents WHERE id=?', attempt.incident_id);
        const contact = this.get('SELECT * FROM contacts WHERE id=?', attempt.contact_id);
        if (
          attempt.status !== 'pending' ||
          attempt.expires_at <= this.now() ||
          !this.eligible(contact, incident) ||
          !contact.external_opt_in ||
          incident.is_test
        ) {
          this.run(
            "UPDATE outbox SET status='cancelled',updated_at=? WHERE id=?",
            this.now(),
            job.id,
          );
          continue;
        }
        this.run(
          "UPDATE outbox SET status='sending',next_due_at=?,updated_at=? WHERE id=?",
          this.now() + 30000,
          this.now(),
          job.id,
        );
        try {
          const response = await fetchImpl(this.webhook, {
            method: 'POST',
            signal: AbortSignal.timeout(5000),
            headers: {
              'Content-Type': 'application/json',
              'Idempotency-Key': job.id,
              ...(process.env.NOTIFICATION_WEBHOOK_TOKEN
                ? { Authorization: 'Bearer ' + process.env.NOTIFICATION_WEBHOOK_TOKEN }
                : {}),
            },
            body: JSON.stringify({
              type: 'care_request',
              incident_id: incident.id,
              recipient_id: contact.user_id,
              message: 'A care request is waiting in your Saathi inbox.',
              url: process.env.APP_URL || 'http://localhost:3001',
            }),
          });
          if (!response.ok) throw new Error('Provider did not accept the notification.');
          this.run(
            "UPDATE outbox SET status='accepted_by_provider',updated_at=?,last_error=NULL WHERE id=?",
            this.now(),
            job.id,
          );
        } catch {
          const retries = job.retries + 1;
          this.run(
            'UPDATE outbox SET status=?,retries=?,next_due_at=?,last_error=?,updated_at=? WHERE id=?',
            retries >= 3 ? 'failed' : 'retry',
            retries,
            this.now() + retries * 5000,
            'External delivery failed. In-app invitation remains available.',
            this.now(),
            job.id,
          );
        }
      }
    } finally {
      this.sending = false;
    }
  }
}

export function installCare(app, service) {
  app.get('/api/summary/daily', (req, res) => res.json(dailySummary(service, req.user)));
  app.get('/api/dashboard', (req, res) => res.json(service.dashboard(req.user)));
  app.get('/api/coverage', (req, res) => res.json(service.coverage(req.user)));
  app.put('/api/coverage/me', (req, res) => res.json(service.updateCoverage(req.user, req.body)));
  app.post('/api/contacts/invite', (req, res) =>
    res.json(service.createInvite(req.user, req.body)),
  );
  app.patch('/api/contacts/:id', (req, res) =>
    res.json(service.updateContact(req.user, req.params.id, req.body)),
  );
  app.get('/api/contacts/:id/preview', (req, res) =>
    res.json(service.preview(req.user, req.params.id)),
  );
  app.post('/api/check-ins', (req, res) => res.json(service.checkIn(req.user, req.body)));
  app.post('/api/reminders', (req, res) => res.json(service.reminder(req.user, req.body)));
  app.patch('/api/reminders/:id', (req, res) =>
    res.json(service.updateReminder(req.user, req.params.id, req.body)),
  );
  app.post('/api/incidents', (req, res) => res.json(service.createIncident(req.user, req.body)));
  app.post('/api/drills', (req, res) =>
    res.json(
      service.createIncident(
        req.user,
        {
          ...req.body,
          title: 'Practice check-in request',
          private_note: 'Synthetic private note: this is a rehearsal, not a real care event.',
        },
        true,
      ),
    ),
  );
  app.get('/api/incidents/:id', (req, res) =>
    res.json(service.view(req.user, service.incident(req.user, req.params.id))),
  );
  app.post('/api/incidents/:id/respond', (req, res) =>
    res.json(service.respond(req.user, req.params.id, req.body)),
  );
}
