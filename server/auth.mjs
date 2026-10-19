import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import languages from '../shared/languages.json' with { type: 'json' };
import { hashPassword, verifyPassword, hashToken, id, publicUser, transaction } from './db.mjs';

export class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const requireThat = (condition, status, message) => {
  if (!condition) throw new AppError(status, message);
};
const credentials = z.object({
  email: z
    .string()
    .email()
    .max(254)
    .transform((x) => x.toLowerCase().trim()),
  password: z.string().min(12).max(128),
});
const languageSchema = z.enum(languages.filter((language) => language.available).map((language) => language.code));
const registerSchema = credentials.extend({
  language: languageSchema.default('en'),
  name: z.string().trim().min(2).max(70),
  timezone: z.string().max(80).default('Asia/Kolkata'),
  inviteCode: z.string().max(100).optional(),
});

export function installAuth(app, db, config) {
  const attempts = new Map();
  const rateLimit = (req, _res, next) => {
    const key = req.ip;
    const now = Date.now();
    for (const [k, v] of attempts) if (v.reset < now) attempts.delete(k);
    const entry = attempts.get(key) || { count: 0, reset: now + 60000 };
    entry.count += 1;
    attempts.set(key, entry);
    if (entry.count > 20)
      return next(new AppError(429, 'Too many attempts. Please wait a minute.'));
    next();
  };
  function session(res, user) {
    const token = randomBytes(32).toString('hex');
    db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(
      hashToken(token),
      user.id,
      Date.now() + 7 * 86400000,
    );
    res.cookie('saathi_session', token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: config.secureCookie,
      maxAge: 7 * 86400000,
      path: '/',
    });
    return res.json({ user: publicUser(user) });
  }
  app.post('/api/auth/login', rateLimit, (req, res) => {
    const data = credentials.parse(req.body);
    const user = db.prepare('SELECT * FROM users WHERE email=?').get(data.email);
    // Use scrypt on both paths to avoid an obvious account-existence timing difference.
    const dummy = '0'.repeat(32) + ':' + '0'.repeat(128);
    const valid = verifyPassword(data.password, user?.password_hash || dummy);
    requireThat(user && valid, 401, 'Email or password is incorrect.');
    session(res, user);
  });
  app.post('/api/auth/register', rateLimit, (req, res) => {
    const data = registerSchema.parse(req.body);
    try {
      new Intl.DateTimeFormat('en', { timeZone: data.timezone }).format();
    } catch {
      throw new AppError(400, 'Please choose a valid timezone.');
    }
    requireThat(
      !db.prepare('SELECT id FROM users WHERE email=?').get(data.email),
      409,
      'An account with this email already exists.',
    );
    const userId = id();
    transaction(db, () => {
      let invite;
      let elder;
      if (data.inviteCode) {
        invite = db
          .prepare(
            'SELECT * FROM invitations WHERE token_hash=? AND used_at IS NULL AND expires_at>?',
          )
          .get(hashToken(data.inviteCode), Date.now());
        requireThat(
          invite && invite.email === data.email,
          400,
          'This invitation is invalid, expired, or belongs to another email.',
        );
        elder = db.prepare('SELECT * FROM users WHERE id=?').get(invite.elder_id);
      }
      db.prepare(
        'INSERT INTO users (id,household_id,name,email,password_hash,role,timezone,language,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
      ).run(
        userId,
        elder?.household_id || id(),
        data.name,
        data.email,
        hashPassword(data.password),
        elder ? 'caregiver' : 'elder',
        data.timezone,
        data.language,
        Date.now(),
      );
      if (invite) {
        const priority = db
          .prepare('SELECT COALESCE(MAX(priority),0)+1 AS n FROM contacts WHERE elder_id=?')
          .get(elder.id).n;
        db.prepare(
          'INSERT INTO contacts (id,elder_id,user_id,relationship,priority) VALUES (?,?,?,?,?)',
        ).run(id(), elder.id, userId, invite.relationship, priority);
        db.prepare('UPDATE invitations SET used_at=? WHERE token_hash=?').run(
          Date.now(),
          invite.token_hash,
        );
        db.prepare('INSERT INTO audit VALUES (?,?,?,?,?,?,?,?)').run(
          id(),
          elder.id,
          userId,
          'invitation_accepted',
          `${data.name} joined your care circle.`,
          'allow',
          1,
          Date.now(),
        );
      }
    });
    session(res, db.prepare('SELECT * FROM users WHERE id=?').get(userId));
  });
  app.post('/api/auth/demo', rateLimit, (req, res) => {
    requireThat(config.demo, 404, 'Demo mode is disabled.');
    const name = z.enum(['meera', 'arjun', 'leela']).parse(req.body.user);
    session(res, db.prepare('SELECT * FROM users WHERE id=? AND is_demo=1').get(name));
  });
  app.use('/api', (req, res, next) => {
    const token = (req.headers.cookie || '')
      .split(';')
      .map((x) => x.trim())
      .find((x) => x.startsWith('saathi_session='))
      ?.slice(15);
    const user =
      token &&
      db
        .prepare(
          'SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires_at>?',
        )
        .get(hashToken(token), Date.now());
    if (!user) return next(new AppError(401, 'Please sign in to continue.'));
    req.user = user;
    next();
  });
  app.get('/api/auth/me', (req, res) => res.json({ user: publicUser(req.user) }));
  app.patch('/api/auth/preferences', (req, res) => {
    const { language } = z.object({ language: languageSchema }).strict().parse(req.body);
    db.prepare('UPDATE users SET language=? WHERE id=?').run(language, req.user.id);
    res.json({ user: publicUser({ ...req.user, language }) });
  });
  app.post('/api/auth/logout', (req, res) => {
    const token = (req.headers.cookie || '')
      .split(';')
      .map((x) => x.trim())
      .find((x) => x.startsWith('saathi_session='))
      ?.slice(15);
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hashToken(token));
    res.clearCookie('saathi_session', {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      secure: config.secureCookie,
    });
    res.json({ ok: true });
  });
}
