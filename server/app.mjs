import express from 'express';
import { ZodError } from 'zod';
import { openDatabase, seedDemo } from './db.mjs';
import { installAuth, AppError } from './auth.mjs';

export function createApp(options = {}) {
  const config = {
    demo: process.env.DEMO_MODE ? process.env.DEMO_MODE === 'true' : process.env.NODE_ENV !== 'production',
    secureCookie: process.env.COOKIE_SECURE === 'true' || (process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false'),
    databasePath: process.env.DATABASE_PATH || './data/saathi.sqlite',
    ...options,
  };
  const db = options.db || openDatabase(config.databasePath);
  if (config.demo) seedDemo(db);
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    if (req.path.startsWith('/api')) res.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers['x-saathi-client'] !== 'web') return next(new AppError(403, 'Missing request protection header.'));
    next();
  });
  app.use(express.json({ limit: '24kb' }));
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', demo: config.demo, ai: process.env.AI_API_KEY && process.env.AI_MODEL ? 'live' : 'local', notifications: process.env.NOTIFICATION_WEBHOOK_URL ? 'webhook' : 'in-app' }));
  installAuth(app, db, config);
  function finish() {
    app.use('/api', (_req, _res, next) => next(new AppError(404, 'This action was not found.')));
    app.use((err, _req, res, _next) => {
      if (err instanceof ZodError) return res.status(400).json({ error: err.issues.map(i => i.message).join(' ') });
      if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON request.' });
      if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large.' });
      if (!err.status) console.error('Application error:', err);
      res.status(err.status || 500).json({ error: err.status ? err.message : 'Something went wrong. Please try again.' });
    });
  }
  return { app, db, config, finish, close: () => db.close() };
}
