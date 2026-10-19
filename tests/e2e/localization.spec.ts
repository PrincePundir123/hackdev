import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync, mkdirSync } from 'node:fs';
const english = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));
const languages: { code: string; available: boolean; dir: string }[] = JSON.parse(
  readFileSync('shared/languages.json', 'utf8'),
);

const keys = Object.keys(english);
function translator(code: string) {
  const values: Record<string, string> = JSON.parse(
    readFileSync(`src/locales/${code}.json`, 'utf8'),
  );
  return (key: string) => values[key] || key;
}
const hi = translator('hi');
const ur = translator('ur');
async function saveEnglish(page: Page) {
  await page.request
    .patch('/api/auth/preferences', {
      data: { language: 'en' },
      headers: { 'X-Saathi-Client': 'web' },
      timeout: 5000,
    })
    .catch(() => {});
}

test('every enabled language loads its local interface and persists the guest choice', async ({
  page,
}) => {
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  await page.goto('/');
  for (const entry of languages.filter(
    (language) => language.available && language.code !== 'en',
  )) {
    const text = translator(entry.code);
    await page.locator('.language-picker select').selectOption(entry.code);
    await expect(page.locator('html')).toHaveAttribute('lang', entry.code);
    await expect(page.locator('html')).toHaveAttribute('dir', entry.dir);
    await expect(page.locator('.demo-person strong').first()).toContainText(
      text('Continue as ').trim(),
    );
    await expect(page.locator('.demo-person strong').first()).toContainText('Meera');
    await expect(
      page.getByRole('heading', {
        name: `${text('Good care starts')} ${text('with connection.')}`,
      }),
    ).toBeVisible();
  }
  await page.reload();
  const last = languages.filter((language) => language.available && language.code !== 'en').at(-1)!;
  await expect(page.locator('html')).toHaveAttribute('lang', last.code);
  expect(failures).toEqual([]);
});

test('Hindi confirmation saves original text; preferences survive reload and stay separate for caregivers', async ({
  page,
  browser,
}) => {
  const caregiverContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const caregiver = await caregiverContext.newPage();
  try {
    await page.goto('/');
    await page.getByRole('button', { name: 'Continue as Meera' }).click();
    await expect(page.locator('.topbar')).toBeVisible();
    await page.locator('.language-picker select').selectOption('hi');
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
    await page.getByRole('button', { name: hi('My reminders'), exact: true }).click();
    await page.getByRole('button', { name: hi('Add reminder'), exact: true }).click();
    const original = 'Call माँ — keep this exact personal text';
    await page.getByLabel(hi('What should we remind you about?'), { exact: true }).fill(original);
    await page.getByRole('button', { name: hi('Review request'), exact: true }).click();
    await expect(page.getByRole('heading', { name: hi('Does this look right?') })).toBeVisible();
    await expect(page.getByRole('dialog').getByText(original, { exact: true })).toBeVisible();
    mkdirSync('docs/screenshots', { recursive: true });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: 'docs/screenshots/language-hindi.png', fullPage: true });
    await page.getByRole('button', { name: hi('Confirm'), exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
    const dashboard = await page.request.get('/api/dashboard').then((response) => response.json());
    expect(
      dashboard.reminders.some((reminder: { title: string }) => reminder.title === original),
    ).toBe(true);

    await caregiver.goto('/');
    await caregiver.getByRole('button', { name: 'Continue as Arjun' }).click();
    await expect(caregiver.locator('.topbar')).toBeVisible();
    await expect(caregiver.locator('html')).toHaveAttribute('lang', 'en');
    await caregiver.locator('.language-picker select').selectOption('ur');
    await expect(caregiver.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
    await caregiver.getByRole('button', { name: ur('Open navigation'), exact: true }).click();
    await expect(caregiver.locator('.sidebar')).toHaveClass(/open/);
    await caregiver
      .getByRole('button', { name: ur('My weekly hours'), exact: true })
      .click({ timeout: 10000 });
    await expect(caregiver.locator('.coverage-stat h2').first()).not.toHaveText(
      /Within my hours|Outside my hours/,
    );
    await caregiver.getByRole('button', { name: ur('Edit my weekly hours'), exact: true }).click();
    await expect(caregiver.getByRole('dialog')).toBeVisible();
    await expect(
      caregiver
        .getByRole('dialog')
        .getByRole('button', { name: ur('Save weekly hours'), exact: true }),
    ).toBeVisible();
    const scan = await new AxeBuilder({ page: caregiver })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      scan.violations.filter(
        (violation) => violation.impact === 'serious' || violation.impact === 'critical',
      ),
    ).toEqual([]);
    await caregiver.getByRole('button', { name: ur('Cancel'), exact: true }).click();
    await caregiver.evaluate(() => document.fonts.ready);
    await caregiver.screenshot({
      path: 'docs/screenshots/language-urdu-mobile.png',
      fullPage: true,
    });
    expect(await caregiver.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const saved = await caregiver.request.get('/api/auth/me').then((response) => response.json());
    expect(saved.user.language).toBe('ur');
    await caregiver.reload();
    await expect(caregiver.locator('html')).toHaveAttribute('lang', 'ur');
  } finally {
    await saveEnglish(page);
    await saveEnglish(caregiver);
    await caregiverContext.close();
  }
});
