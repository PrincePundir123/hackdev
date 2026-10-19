import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const headers = { 'X-Saathi-Client': 'web' };
async function login(page: Page, name: string) {
  await page.goto('/');
  await page.getByRole('button', { name: `Continue as ${name}` }).click();
  await expect(page.getByRole('heading', { name: new RegExp(`Good .*, ${name}`) })).toBeVisible();
}
async function resetPlan(page: Page) {
  const report = await page.request.get('/api/coverage').then((r) => r.json());
  const response = await page.request.put('/api/coverage/me', {
    headers,
    data: { mode: 'anytime', windows: [], version: report.contacts[0].version },
  });
  expect(response.ok()).toBe(true);
}
async function resetPermissions(page: Page) {
  for (const [id, priority] of [
    ['contact-arjun', 1],
    ['contact-leela', 2],
  ] as const) {
    const response = await page.request.patch(`/api/contacts/${id}`, {
      headers,
      data: {
        allow_requests: true,
        allow_notes: id === 'contact-arjun',
        allow_reminders: id === 'contact-arjun',
        priority,
      },
    });
    expect(response.ok()).toBe(true);
  }
}

test('caregivers save their hours and the older adult sees precise gaps and an accessible weekly plan', async ({
  browser,
}) => {
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
    browser.newContext(),
  ]);
  const [elder, arjun, leela] = await Promise.all(contexts.map((c) => c.newPage()));
  try {
    await login(elder, 'Meera');
    await resetPermissions(elder);
    await login(arjun, 'Arjun');
    await resetPlan(arjun);
    await login(leela, 'Leela');
    await resetPlan(leela);
    for (const [page, start, end] of [
      [arjun, '18:00', '22:00'],
      [leela, '09:00', '14:00'],
    ] as const) {
      await page.getByRole('button', { name: 'My weekly hours', exact: true }).click();
      await page.getByRole('button', { name: 'Edit my weekly hours' }).click();
      await page.getByRole('radio', { name: /Only during my weekly hours/ }).check();
      await page.getByRole('button', { name: 'Add Monday hours', exact: true }).click();
      await page.getByLabel('Monday start 1', { exact: true }).fill(start);
      await page.getByLabel('Monday end 1', { exact: true }).fill(end);
      await page.getByRole('button', { name: 'Save weekly hours' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    }
    await elder.getByRole('button', { name: 'Care coverage', exact: true }).click();
    await expect(
      elder.getByRole('heading', { name: 'Know when your circle is covered.' }),
    ).toBeVisible();
    await elder.getByRole('button', { name: 'Monday, 15h Gap', exact: true }).click();
    const gap = elder.locator('.coverage-interval').filter({ hasText: '14:00–18:00' });
    await expect(gap.getByText('No responder scheduled', { exact: true })).toBeVisible();
    await expect(
      elder
        .locator('.coverage-interval')
        .filter({ hasText: '09:00–14:00' })
        .getByText('Leela Rao', { exact: true }),
    ).toBeVisible();
    const scan = await new AxeBuilder({ page: elder })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      scan.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    ).toEqual([]);
    await arjun.reload();
    await arjun.getByRole('button', { name: 'My weekly hours', exact: true }).click();
    await arjun.getByRole('button', { name: 'Edit my weekly hours' }).click();
    await expect(arjun.getByLabel('Monday start 1', { exact: true })).toHaveValue('18:00');
    const editorScan = await new AxeBuilder({ page: arjun })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      editorScan.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    ).toEqual([]);
  } finally {
    for (const context of contexts) await context.close();
  }
});

test('mobile schedule changes affect routing and a stale editor cannot overwrite another save', async ({
  browser,
}) => {
  const elderContext = await browser.newContext();
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const backupContext = await browser.newContext();
  const elder = await elderContext.newPage();
  const mobile = await mobileContext.newPage();
  try {
    await login(elder, 'Meera');
    await resetPermissions(elder);
    await login(mobile, 'Arjun');
    await resetPlan(mobile);
    await backupContext.request.post('/api/auth/demo', { headers, data: { user: 'leela' } });
    const backup = await backupContext.request.get('/api/coverage').then((r) => r.json());
    await backupContext.request.put('/api/coverage/me', {
      headers,
      data: { mode: 'anytime', windows: [], version: backup.contacts[0].version },
    });
    await mobile.getByRole('button', { name: 'Open navigation' }).click();
    await mobile.getByRole('button', { name: 'My weekly hours', exact: true }).click();
    await mobile.getByRole('button', { name: 'Edit my weekly hours' }).click();
    await mobile.getByRole('radio', { name: /Only during my weekly hours/ }).check();
    await mobile.getByRole('button', { name: 'Save weekly hours' }).click();
    await expect(mobile.getByRole('dialog')).not.toBeVisible();
    await expect(mobile.getByRole('heading', { name: 'Outside my hours' })).toBeVisible();
    expect(
      await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await elder.getByRole('button', { name: /^Request help/ }).click();
    await expect(elder.getByRole('dialog').getByText('Leela Rao', { exact: true })).toBeVisible();
    await expect(
      elder.getByRole('dialog').getByText('Arjun Sharma', { exact: true }),
    ).not.toBeVisible();
    await elder.getByRole('button', { name: 'Confirm help request' }).click();
    await expect(elder.getByRole('dialog')).toBeVisible();
    const dashboard = await elder.request.get('/api/dashboard').then((r) => r.json());
    expect(dashboard.incidents[0].attempts[0].user_id).toBe('leela');
    await mobile.getByRole('button', { name: 'Edit my weekly hours' }).click();
    await mobile.getByRole('button', { name: 'Add Monday hours', exact: true }).click();
    await resetPlan(mobile); // Another session saves after this editor was opened.
    await expect(
      mobile.locator('.coverage-stat h2').filter({ hasText: 'Within my hours' }),
    ).toBeVisible();
    await mobile.getByRole('button', { name: 'Save weekly hours' }).click();
    await expect(mobile.getByRole('alert').filter({ hasText: /another session/ })).toBeVisible();
    await mobile.getByRole('button', { name: 'Reload latest schedule' }).click();
    await expect(mobile.getByRole('dialog')).not.toBeVisible();
  } finally {
    await elderContext.close();
    await mobileContext.close();
    await backupContext.close();
  }
});
