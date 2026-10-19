import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

test(
  'production serves the built PWA with private APIs and secure non-demo authentication',
  { timeout: 30000 },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), 'saathi-production-'));
    let output = '';
    const child = spawn(process.execPath, ['server/index.mjs'], {
      cwd: resolve('.'),
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: '0',
        HOST: '127.0.0.1',
        DATABASE_PATH: join(directory, 'production.sqlite'),
        DEMO_MODE: 'false',
        COOKIE_SECURE: 'true',
        AI_API_KEY: '',
        NOTIFICATION_WEBHOOK_URL: '',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
    });
    const exited = new Promise((done) => child.once('exit', done));
    try {
      // Read the actual bound port so this test never collides with a running app.
      for (
        let attempt = 0;
        attempt < 100 && !output.match(/ready at http:\/\/localhost:(\d+)/);
        attempt++
      ) {
        assert.equal(child.exitCode, null, output);
        await delay(100);
      }
      const port = output.match(/ready at http:\/\/localhost:(\d+)/)?.[1];
      assert.ok(port && port !== '0', output);
      const base = `http://127.0.0.1:${port}`;
      const health = await fetch(`${base}/api/health`);
      assert.equal(health.status, 200);
      assert.equal(health.headers.get('cache-control'), 'no-store');
      assert.equal((await health.json()).demo, false);
      for (const path of ['/', '/care/requests']) {
        const page = await fetch(base + path);
        assert.equal(page.status, 200);
        assert.match(await page.text(), /<div id="root"><\/div>/);
        assert.equal(page.headers.get('cache-control'), 'no-cache');
      }
      for (const path of ['/sw.js', '/manifest.webmanifest', '/offline.html']) {
        const response = await fetch(base + path);
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('cache-control'), 'no-cache');
      }
      assert.equal((await fetch(`${base}/api/dashboard`)).status, 401);
      const missing = await fetch(`${base}/api/not-found`);
      assert.equal(missing.status, 401);
      assert.match(missing.headers.get('content-type'), /application\/json/);
      const post = (path, body) =>
        fetch(base + path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Saathi-Client': 'web' },
          body: JSON.stringify(body),
        });
      assert.equal((await post('/api/auth/demo', { user: 'meera' })).status, 404);
      const registered = await post('/api/auth/register', {
        name: 'Production smoke test',
        email: 'smoke@example.test',
        password: 'SmokeTestPassword123!',
      });
      assert.equal(registered.status, 200);
      const cookie = registered.headers.get('set-cookie');
      assert.match(cookie, /HttpOnly/i);
      assert.match(cookie, /Secure/i);
      assert.match(cookie, /SameSite=Strict/i);
    } finally {
      child.kill();
      await exited;
      await rm(directory, { recursive: true, force: true });
    }
  },
);
