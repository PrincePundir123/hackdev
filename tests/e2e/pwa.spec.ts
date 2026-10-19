import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync, mkdtempSync } from 'node:fs';

const catalog: { code: string; available: boolean; dir: string }[] = JSON.parse(
  readFileSync('shared/languages.json', 'utf8'),
);
const dictionary = (code: string): Record<string, string> =>
  JSON.parse(readFileSync(`src/locales/${code}.json`, 'utf8'));
async function ready(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue as Meera' }).waitFor();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}
async function settings(page: Page) {
  await page.getByRole('button', { name: 'Continue as Meera' }).click();
  await page.getByRole('heading', { name: /Good .*, Meera/ }).waitFor();
  const mobile = page.getByRole('button', { name: 'Open navigation' });
  if (await mobile.isVisible()) await mobile.click();
  await page.getByRole('button', { name: 'Settings & accessibility' }).click();
}

test('production manifest, icons and worker are installable and cache only public files', async ({
  playwright,
}) => {
  // OS installation is unavailable in Playwright's usual private browser contexts.
  const context = await playwright.chromium.launchPersistentContext(
    mkdtempSync('.runtime/pwa-profile-'),
    {
      channel:
        process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'chrome' : undefined),
      headless: true,
      baseURL: 'http://127.0.0.1:4011',
    },
  );
  try {
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await ready(page);
    const session = await context.newCDPSession(page);
    const appManifest = await session.send('Page.getAppManifest');
    expect(appManifest.errors).toEqual([]);
    const manifest = JSON.parse(appManifest.data!);
    expect(manifest).toMatchObject({
      id: '/',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      theme_color: '#00264d',
    });
    expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toContain('192x192');
    expect(manifest.icons.some((icon: { purpose: string }) => icon.purpose === 'maskable')).toBe(
      true,
    );
    for (const [path, size] of [
      ['icon-192', 192],
      ['icon-512', 512],
      ['maskable-512', 512],
      ['apple-touch-icon', 180],
    ] as const) {
      const response = await page.request.get(`/icons/${path}.png`);
      expect(response.ok()).toBe(true);
      const bytes = await response.body();
      expect(bytes.readUInt32BE(16)).toBe(size);
      expect(bytes.readUInt32BE(20)).toBe(size);
    }
    for (const path of ['/sw.js', '/manifest.webmanifest', '/offline.html']) {
      const response = await page.request.get(path);
      expect(response.headers()['cache-control']).toBe('no-cache');
    }
    const installability = await session.send('Page.getInstallabilityErrors');
    expect(installability.installabilityErrors).toEqual([]);
    await settings(page);
    await page.evaluate(async () => {
      await fetch('/api/dashboard');
      await fetch('/api/summary/daily');
      await fetch('/api/not-found');
    });
    const cached = await page.evaluate(async () => {
      const result: string[] = [];
      for (const name of await caches.keys()) {
        for (const request of await (await caches.open(name)).keys())
          result.push(new URL(request.url).pathname);
      }
      return result.sort();
    });
    expect(cached).toEqual(
      [
        '/favicon.svg',
        '/icons/apple-touch-icon.png',
        '/icons/icon-192.png',
        '/icons/icon-512.png',
        '/icons/maskable-512.png',
        '/manifest.webmanifest',
        '/offline.html',
      ].sort(),
    );
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test('offline reload uses every enabled language, reveals no care data, and recovers online', async ({
  page,
  context,
}) => {
  await ready(page);
  await settings(page);
  await context.setOffline(true);
  for (const language of catalog.filter((entry) => entry.available)) {
    const text = dictionary(language.code);
    await page.evaluate((code) => localStorage.setItem('saathi:language', code), language.code);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', language.code);
    await expect(page.locator('html')).toHaveAttribute('dir', language.dir);
    await expect(page.getByRole('heading')).toHaveText(text['We couldn’t reach your care space.']);
    await expect(page.locator('body')).not.toContainText('Meera');
    await expect(page.locator('#privacy')).toHaveText(
      text[
        'Care updates need an internet connection. Private care records are not saved for offline use.'
      ],
    );
  }
  expect(
    await page.evaluate(async () => {
      try {
        await fetch('/api/dashboard');
        return 'unexpected response';
      } catch {
        return 'network failure';
      }
    }),
  ).toBe('network failure');
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(
    scan.violations.filter((issue) => ['serious', 'critical'].includes(issue.impact || '')),
  ).toEqual([]);
  await context.setOffline(false);
  await page.getByRole('button').click();
  await expect(page.getByRole('heading', { name: /Good .*, Meera/ })).toBeVisible();
});

test('a check-in attempted offline is not queued or sent after reconnection', async ({
  page,
  context,
}) => {
  await ready(page);
  await page.getByRole('button', { name: 'Continue as Meera' }).click();
  await page.getByRole('heading', { name: /Good .*, Meera/ }).waitFor();
  const before = await page.evaluate(
    async () => (await (await fetch('/api/dashboard')).json()).last_check_in,
  );
  await context.setOffline(true);
  await expect(
    page.getByRole('alert').filter({ hasText: 'Connection unavailable.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'I am okay', exact: true }).click();
  await expect(page.locator('.toast.error')).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByRole('alert').filter({ hasText: 'Connection unavailable.' })).toHaveCount(
    0,
  );
  const after = await page.evaluate(
    async () => (await (await fetch('/api/dashboard')).json()).last_check_in,
  );
  expect(after).toBe(before);
});

test('install controls handle simulated prompt dismissal, failure and installation without changing care records', async ({
  page,
}) => {
  await ready(page);
  await settings(page);
  const card = page.getByTestId('install-app');
  await page.evaluate(() => {
    window.dispatchEvent(
      Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
        prompt: async () => {},
        userChoice: Promise.resolve({ outcome: 'dismissed' }),
      }),
    );
  });
  await card.getByRole('button', { name: 'Install app', exact: true }).click();
  await expect(card.getByRole('button')).toHaveCount(0);
  await expect(card.getByRole('status')).toHaveCount(0);
  await page.evaluate(() => {
    window.dispatchEvent(
      Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
        prompt: async () => {
          throw new Error('Unavailable');
        },
        userChoice: Promise.resolve({ outcome: 'dismissed' }),
      }),
    );
  });
  await card.getByRole('button', { name: 'Install app', exact: true }).click();
  await expect(card.getByRole('alert')).toBeVisible();
  await page.evaluate(() => {
    window.dispatchEvent(
      Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
        prompt: async () => {},
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      }),
    );
  });
  await card.getByRole('button', { name: 'Install app', exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
  await expect(card.getByRole('status')).toHaveText('App installed');
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(
    scan.violations.filter((issue) => ['serious', 'critical'].includes(issue.impact || '')),
  ).toEqual([]);
});

test('iPhone install guidance is visible on mobile and standalone mode reports installed', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
  });
  try {
    const page = await context.newPage();
    await ready(page);
    await settings(page);
    await expect(page.getByTestId('install-app')).toContainText('On iPhone or iPad, open Share');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  } finally {
    await context.close();
  }
  const standalone = await browser.newContext();
  try {
    await standalone.addInitScript(() => {
      const match = window.matchMedia.bind(window);
      window.matchMedia = (query) => {
        const result = match(query);
        if (query === '(display-mode: standalone)')
          Object.defineProperty(result, 'matches', { value: true });
        return result;
      };
    });
    const page = await standalone.newPage();
    await ready(page);
    await settings(page);
    await expect(page.getByTestId('install-app').getByRole('status')).toHaveText('App installed');
  } finally {
    await standalone.close();
  }
});
