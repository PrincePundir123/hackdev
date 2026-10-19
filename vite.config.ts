import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import languages from './shared/languages.json' with { type: 'json' };

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'saathi-private-safe-pwa',
      apply: 'build',
      generateBundle() {
        const messages = Object.fromEntries(
          languages
            .filter((entry) => entry.available)
            .map((entry) => {
              const dictionary = JSON.parse(readFileSync(`src/locales/${entry.code}.json`, 'utf8'));
              const text = (key: string) => {
                if (!dictionary[key])
                  throw new Error(`Missing offline translation: ${entry.code}: ${key}`);
                return dictionary[key];
              };
              return [
                entry.code,
                {
                  dir: entry.dir,
                  heading: text('We couldn’t reach your care space.'),
                  message: text(
                    'Connection unavailable. Updates may be stale. New actions are not queued offline.',
                  ),
                  privacy: text(
                    'Care updates need an internet connection. Private care records are not saved for offline use.',
                  ),
                  retry: text('Try again'),
                  footnote: text('Care coordination prototype · Not an emergency service'),
                },
              ];
            }),
        );
        const offline = readFileSync('src/pwa/offline.html', 'utf8').replace(
          '__PWA_MESSAGES__',
          JSON.stringify(messages).replaceAll('<', '\\u003c'),
        );
        const hash = createHash('sha256').update(offline);
        for (const file of [
          'manifest.webmanifest',
          'favicon.svg',
          'icons/icon-192.png',
          'icons/icon-512.png',
          'icons/maskable-512.png',
          'icons/apple-touch-icon.png',
        ])
          hash.update(readFileSync(`public/${file}`));
        const source = readFileSync('src/pwa/service-worker.js', 'utf8');
        const revision = hash.update(source).digest('hex').slice(0, 16);
        this.emitFile({ type: 'asset', fileName: 'offline.html', source: offline });
        this.emitFile({
          type: 'asset',
          fileName: 'sw.js',
          source: source.replace('__PWA_REVISION__', revision),
        });
      },
    },
  ],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:3001' },
  },
});
