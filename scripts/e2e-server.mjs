import { resolve } from 'node:path';
process.env.PORT = '4011';
process.env.HOST = '127.0.0.1';
process.env.DATABASE_PATH = resolve('.runtime', `e2e-${Date.now()}.sqlite`);
process.env.DEMO_MODE = 'true';
process.env.COOKIE_SECURE = 'false';
process.env.AI_API_KEY = '';
process.env.NOTIFICATION_WEBHOOK_URL = '';
await import('../server/index.mjs');
