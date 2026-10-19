import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync, mkdirSync } from 'node:fs';

const headers = { 'X-Saathi-Client': 'web' };
async function login(page: Page, person: string) {
  await page.goto('/');
  await page.getByRole('button', { name: `Continue as ${person}` }).click();
  await expect(page.locator('.topbar')).toBeVisible();
}
async function summary(page: Page) {
  return page.request.get('/api/summary/daily').then((response) => response.json());
}

test('caregiver daily summary follows explicit sharing, reminder completion, and request resolution', async ({
  browser,
}) => {
  const elderContext = await browser.newContext();
  const caregiverContext = await browser.newContext();
  const elder = await elderContext.newPage();
  const caregiver = await caregiverContext.newPage();
  let original: Record<string, unknown> | undefined;
  try {
    await login(elder, 'Meera');
    const dashboard = await elder.request.get('/api/dashboard').then((response) => response.json());
    const contact = dashboard.contacts.find(
      (entry: { user_id: string }) => entry.user_id === 'arjun',
    );
    original = {
      allow_requests: !!contact.allow_requests,
      allow_notes: !!contact.allow_notes,
      allow_reminders: !!contact.allow_reminders,
      allow_checkins: !!contact.allow_checkins,
      priority: contact.priority,
    };
    await elder.request.patch('/api/contacts/contact-arjun', {
      headers,
      data: { ...original, allow_requests: true, allow_reminders: true, allow_checkins: false },
    });
    await login(caregiver, 'Arjun');
    const coverage = await caregiver.request
      .get('/api/coverage')
      .then((response) => response.json());
    await caregiver.request.put('/api/coverage/me', {
      headers,
      data: { mode: 'anytime', windows: [], version: coverage.contacts[0].version },
    });
    const title = `Summary reminder ${Date.now()}`;
    const reminder = await elder.request
      .post('/api/reminders', {
        headers,
        data: {
          client_key: crypto.randomUUID(),
          title,
          trigger_type: 'fixed',
          due_at: Date.now() + 2000,
        },
      })
      .then((response) => response.json());
    expect(reminder.title).toBe(title);
    await elder.getByRole('button', { name: 'I am okay', exact: true }).click();
    await caregiver.getByRole('button', { name: 'Daily summary', exact: true }).click();
    await expect(
      caregiver.getByTestId('summary-checkin').getByText('Not shared', { exact: true }),
    ).toBeVisible();
    await expect(
      caregiver.getByTestId('summary-reminders').getByText(title, { exact: true }),
    ).toBeVisible({ timeout: 15000 });
    const before = await summary(caregiver);
    await elder.getByRole('button', { name: 'My care circle', exact: true }).click();
    await elder
      .locator('.contact-card')
      .filter({ hasText: 'Arjun Sharma' })
      .getByRole('button', { name: 'Edit permissions' })
      .click();
    await elder.getByRole('switch', { name: /^Check-in sharing/ }).check();
    await elder.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(elder.getByRole('dialog')).not.toBeVisible();
    await caregiver.getByRole('button', { name: 'Refresh summary', exact: true }).click();
    await expect(
      caregiver
        .getByTestId('summary-checkin')
        .getByText('Check-in recorded today.', { exact: true }),
    ).toBeVisible();

    await elder.getByRole('button', { name: 'My reminders', exact: true }).click();
    await elder.getByRole('button', { name: `Mark ${title} done`, exact: true }).click();
    await caregiver.getByRole('button', { name: 'Refresh summary', exact: true }).click();
    await expect(
      caregiver
        .getByTestId('summary-reminders')
        .locator('.summary-metrics div')
        .filter({ hasText: 'Completed today' })
        .locator('dd'),
    ).toHaveText(String(before.reminders.completed_today + 1));
    await expect(
      caregiver.getByTestId('summary-reminders').getByText(title, { exact: true }),
    ).not.toBeVisible();

    const requestTitle = `Summary response ${Date.now()}`;
    await elder.request.post('/api/incidents', {
      headers,
      data: {
        client_key: crypto.randomUUID(),
        title: requestTitle,
        private_note: 'Sensitive summary note',
      },
    });
    await caregiver.getByRole('button', { name: 'Refresh summary', exact: true }).click();
    const requestButton = caregiver
      .getByTestId('summary-requests')
      .getByRole('button')
      .filter({ hasText: requestTitle });
    await expect(requestButton).toBeVisible();
    const payload = await summary(caregiver);
    expect(JSON.stringify(payload)).not.toContain('Sensitive summary note');
    const resolved = payload.requests.resolved_today;
    await requestButton.click();
    await caregiver.getByRole('button', { name: 'I will respond', exact: true }).click();
    await caregiver.getByLabel('Record the outcome').fill('Summary test follow-up completed.');
    await caregiver.getByRole('button', { name: 'Record outcome & resolve', exact: true }).click();
    await expect(
      caregiver.getByRole('dialog').getByText('Resolved', { exact: true }),
    ).toBeVisible();
    await caregiver.getByRole('button', { name: 'Close', exact: true }).click();
    await caregiver.getByRole('button', { name: 'Refresh summary', exact: true }).click();
    await expect(
      caregiver
        .getByTestId('summary-requests')
        .locator('.summary-metrics div')
        .filter({ hasText: 'Resolved today' })
        .locator('dd'),
    ).toHaveText(String(resolved + 1));

    mkdirSync('docs/screenshots', { recursive: true });
    await caregiver.screenshot({ path: 'docs/screenshots/daily-summary.png', fullPage: true });
    const scan = await new AxeBuilder({ page: caregiver })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      scan.violations.filter((violation) =>
        ['serious', 'critical'].includes(violation.impact || ''),
      ),
    ).toEqual([]);
    await elder.request.patch('/api/contacts/contact-arjun', {
      headers,
      data: { ...original, allow_checkins: false, allow_reminders: false },
    });
    await caregiver.getByRole('button', { name: 'Refresh summary', exact: true }).click();
    await expect(
      caregiver.getByTestId('summary-checkin').getByText('Not shared', { exact: true }),
    ).toBeVisible();
    await expect(
      caregiver.getByTestId('summary-reminders').getByText('Not shared', { exact: true }),
    ).toBeVisible();
    await caregiver.reload();
    await caregiver.getByRole('button', { name: 'Daily summary', exact: true }).click();
    await expect(
      caregiver.getByTestId('summary-checkin').getByText('Not shared', { exact: true }),
    ).toBeVisible();
  } finally {
    if (original)
      await elder.request
        .patch('/api/contacts/contact-arjun', { headers, data: original })
        .catch(() => {});
    await elderContext.close();
    await caregiverContext.close();
  }
});

test('Urdu mobile summary preserves restricted data and links to the personal coverage planner', async ({
  page,
}) => {
  const ur: Record<string, string> = JSON.parse(readFileSync('src/locales/ur.json', 'utf8'));
  const text = (key: string) => ur[key] || key;
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, 'Leela');
  try {
    await page.locator('.language-picker select').selectOption('ur');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.getByRole('button', { name: text('Open navigation'), exact: true }).click();
    await expect(page.locator('.sidebar')).toHaveClass(/open/);
    await page.getByRole('button', { name: text('Daily summary'), exact: true }).click();
    await expect(
      page.getByRole('heading', { name: text('Today in one place.'), exact: true }),
    ).toBeVisible();
    await expect(
      page.getByTestId('summary-reminders').getByText(text('Not shared'), { exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: 'docs/screenshots/daily-summary-urdu-mobile.png',
      fullPage: true,
      animations: 'disabled',
    });
    await page
      .getByTestId('summary-coverage')
      .getByRole('button', { name: text('My weekly hours'), exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: text('Edit my weekly hours'), exact: true }),
    ).toBeVisible();
  } finally {
    await page.request.patch('/api/auth/preferences', { headers, data: { language: 'en' } });
  }
});
