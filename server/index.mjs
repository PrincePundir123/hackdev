import { createApp } from './app.mjs';
import express from 'express';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

const { app, care, finish, close } = createApp();
const dist = resolve('dist');
if (existsSync(resolve(dist, 'index.html'))) {
  app.use(
    express.static(dist, {
      index: false,
      maxAge: '1h',
      setHeaders(res, path) {
        if (
          ['sw.js', 'manifest.webmanifest', 'offline.html'].some(
            (name) => path.endsWith('/' + name) || path.endsWith('\\' + name),
          )
        ) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    }),
  );
  app.get('/{*path}', (req, res, next) => {
    if (req.path === '/api' || req.path.startsWith('/api/')) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(resolve(dist, 'index.html'));
  });
}
finish();
const worker = setInterval(() => {
  try {
    care.tick();
    care.deliver().catch((error) => console.error('Delivery worker failed:', error.message));
  } catch (error) {
    console.error('Care worker failed:', error.message);
  }
}, 1000);
const server = app.listen(Number(process.env.PORT || 3001), process.env.HOST || '127.0.0.1', () => {
  console.log('Saathi Care API ready at http://localhost:' + (process.env.PORT || 3001));
});
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    clearInterval(worker);
    server.close(() => {
      close();
      process.exit(0);
    });
  });
