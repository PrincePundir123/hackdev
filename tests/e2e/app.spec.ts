import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

async function signIn(page: Page, person: string) {
  await page.goto('/');
  await page.getByRole('button', { name: `Continue as ${person}` }).click();
  await expect(page.getByRole('heading', { name: new RegExp(`Good .*, ${person}`) })).toBeVisible();
}

test('older adult confirms a reminder, checks in, and sees it persist after reload', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await signIn(page, 'Meera');
  await page.getByRole('button', { name: 'Ask your companion' }).click();
  await page
    .getByLabel('What’s on your mind?')
    .fill('Remind me to call my sister 10 minutes after my morning check-in');
  await page.getByRole('button', { name: 'Review request' }).click();
  await expect(page.getByRole('heading', { name: 'Does this look right?' })).toBeVisible();
  const before = await page.request.get('/api/dashboard').then((r) => r.json());
  expect(before.reminders.some((r: { title: string }) => r.title === 'call my sister')).toBe(false);
  await page.getByRole('button', { name: 'Confirm reminder' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'I am okay', exact: true }).click();
  await expect(page.getByText(/Last check-in:/)).toBeVisible();
  await page.getByRole('button', { name: 'My reminders', exact: true }).click();
  await expect(page.getByText('call my sister', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'My reminders', exact: true }).click();
  await expect(page.getByText('call my sister', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('two-account drill, backup acceptance, private-note filtering and outcome recording', async ({
  browser,
}) => {
  const elderContext = await browser.newContext();
  const backupContext = await browser.newContext();
  const elder = await elderContext.newPage();
  const backup = await backupContext.newPage();
  try {
    await signIn(elder, 'Meera');
    await signIn(backup, 'Leela');
    await backup.getByRole('button', { name: 'Care requests', exact: true }).click();
    await elder.getByRole('button', { name: 'Practice a drill', exact: true }).click();
    await elder.getByRole('button', { name: 'Start a practice drill' }).click();
    await expect(elder.getByRole('dialog')).toBeVisible();
    await expect(elder.getByText('Synthetic private note:', { exact: false })).toBeVisible();
    await expect
      .poll(
        async () => {
          const d = await elder.request.get('/api/dashboard').then((r) => r.json());
          return d.incidents[0]?.attempts.some(
            (a: { user_id: string; status: string }) =>
              a.user_id === 'leela' && a.status === 'pending',
          );
        },
        { timeout: 16000, intervals: [1000] },
      )
      .toBe(true);
    const backupData = await backup.request.get('/api/dashboard').then((r) => r.json());
    expect(JSON.stringify(backupData)).not.toContain('Synthetic private note');
    await backup
      .getByRole('button', { name: /A check-in has been requested/ })
      .first()
      .click();
    await backup.getByRole('button', { name: 'I will respond', exact: true }).click();
    await expect(
      backup.getByText('Leela Rao accepted responsibility.', { exact: false }).first(),
    ).toBeVisible();
    await backup
      .getByLabel('Record the outcome')
      .fill('Called Meera and completed the practice check-in.');
    await backup.getByRole('button', { name: 'Record outcome & resolve' }).click();
    await expect(backup.getByRole('dialog').getByText('Resolved', { exact: true })).toBeVisible();
    await expect(
      elder.getByText('Called Meera and completed the practice check-in.', { exact: true }),
    ).toBeVisible();
    mkdirSync('docs/screenshots', { recursive: true });
    await elder.screenshot({ path: 'docs/screenshots/care-timeline.png', fullPage: true });
  } finally {
    await elderContext.close();
    await backupContext.close();
  }
});

test('sharing preview, permission revocation, and responsive navigation', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mobile = await mobileContext.newPage();
  try {
    await signIn(page, 'Meera');
    await page.getByRole('button', { name: 'My care circle', exact: true }).click();
    await page.getByRole('button', { name: 'Preview sharing with Leela Rao' }).click();
    await expect(
      page.getByRole('dialog').getByText('Private notes hidden', { exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: 'docs/screenshots/sharing-preview.png', fullPage: true });
    await page.getByRole('button', { name: 'Got it', exact: true }).click();
    const card = page.locator('.contact-card').filter({ hasText: 'Leela Rao' });
    await card.getByRole('button', { name: 'Edit permissions' }).click();
    await page.getByRole('switch', { name: /Basic help requests/ }).uncheck();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await signIn(mobile, 'Leela');
    const d = await mobile.request.get('/api/dashboard').then((r) => r.json());
    expect(d.incidents).toEqual([]);
    expect(d.reminders).toEqual([]);
    await mobile.getByRole('button', { name: 'Open navigation' }).click();
    await mobile.getByRole('button', { name: 'Care requests', exact: true }).click();
    await expect(
      mobile.getByRole('heading', { name: 'Every request, a clear next step.' }),
    ).toBeVisible();
    expect(
      await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await mobile.screenshot({ path: 'docs/screenshots/mobile.png', fullPage: true });
    await page.getByRole('button', { name: 'Overview', exact: true }).click();
    const dismiss = page.getByRole('button', { name: 'Dismiss message' });
    if (await dismiss.count()) await dismiss.click({ timeout: 1000 }).catch(() => {});
    await page.screenshot({ path: 'docs/screenshots/overview.png', fullPage: true });
  } finally {
    await context.close();
    await mobileContext.close();
  }
});
