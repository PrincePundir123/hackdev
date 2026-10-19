import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

// Run against scripts/e2e-server.mjs, which creates an isolated fictional household.
const output = 'docs/screenshots';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({
  baseURL: 'http://127.0.0.1:4011',
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
const captures = [];
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
async function shot(name, fullPage = true) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${output}/${name}.png`, fullPage, animations: 'disabled' });
  captures.push(name);
  console.log(`Captured ${name}`);
}
async function login(user) {
  const response = await context.request.post('/api/auth/demo', {
    headers: { 'X-Saathi-Client': 'web' },
    data: { user },
  });
  if (!response.ok()) throw new Error(`Login failed: ${response.status()}`);
  await page.goto('/');
  await page.locator('.topbar').waitFor();
}
async function button(name) {
  await page.getByRole('button', { name, exact: true }).click();
}
async function nav(name) {
  await page
    .getByRole('navigation')
    .getByRole('button', {
      name: new RegExp(`^${name}(?:\\s*\\d+)?$`),
    })
    .click();
}
try {
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue as Meera' }).waitFor();
  await shot('01-welcome');
  await login('meera');
  await button('I am okay');
  await shot('02-meera-dashboard');
  await page.getByRole('button', { name: /^Request help/ }).click();
  await page
    .getByLabel('How can your circle help?')
    .fill('Please pick up my medicines from the pharmacy.');
  await shot('03-request-review', false);
  await button('Confirm help request');
  await page.getByRole('dialog').getByText('The care timeline', { exact: true }).waitFor();
  await shot('04-request-timeline', false);
  await login('arjun');
  await shot('05-caregiver-dashboard');
  await nav('Care requests');
  await page
    .locator('.request-card')
    .filter({ hasText: 'Please pick up my medicines' })
    .first()
    .click();
  await button('I will respond');
  await page.getByLabel('Record the outcome').waitFor();
  await shot('06-accepted-request', false);
  await page
    .getByLabel('Record the outcome')
    .fill('Picked up the medicines and delivered them to Meera.');
  await button('Record outcome & resolve');
  await page.getByRole('dialog').getByText('Resolved', { exact: true }).waitFor();
  await shot('07-resolved-request', false);
  await button('Close dialog');
  await nav('My weekly hours');
  await button('Edit my weekly hours');
  await page.getByRole('radio', { name: /Only during my weekly hours/ }).check();
  await button('Add Monday hours');
  await page.getByLabel('Monday start 1', { exact: true }).fill('09:00');
  await page.getByLabel('Monday end 1', { exact: true }).fill('17:00');
  await shot('08-weekly-hours', false);
  await button('Save weekly hours');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await login('leela');
  await nav('My weekly hours');
  await button('Edit my weekly hours');
  await page.getByRole('radio', { name: /Only during my weekly hours/ }).check();
  await button('Add Monday hours');
  await page.getByLabel('Monday start 1', { exact: true }).fill('17:00');
  await page.getByLabel('Monday end 1', { exact: true }).fill('21:00');
  await button('Save weekly hours');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await login('meera');
  await nav('Care coverage');
  await page.getByRole('heading', { name: 'Know when your circle is covered.' }).waitFor();
  await shot('09-coverage-planner');
  await nav('Overview');
  await button('Ask your companion');
  await page
    .getByRole('textbox')
    .first()
    .fill('Remind me to call my sister 10 minutes after my morning check-in');
  await button('Review request');
  await page.getByRole('heading', { name: 'Does this look right?' }).waitFor();
  await shot('10-reminder-confirmation', false);
  await button('Confirm');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await nav('My reminders');
  await page.getByText('call my sister', { exact: true }).waitFor();
  await shot('11-reminders');
  await nav('Daily summary');
  await page.getByTestId('summary-checkin').waitFor();
  await shot('12-daily-summary');
  await nav('My care circle');
  await shot('13-care-circle');
  await page
    .locator('.contact-card')
    .filter({ hasText: 'Arjun Sharma' })
    .getByRole('button', { name: 'Edit permissions' })
    .click();
  await shot('14-sharing-permissions', false);
  await button('Close dialog');
  await button('Preview sharing with Leela Rao');
  await shot('15-sharing-preview', false);
  await button('Close dialog');
  await nav('Overview');
  await page.getByLabel('Choose your language').selectOption('hi');
  await shot('16-hindi-interface');
  await page.locator('.language-picker select').first().selectOption('en');
  await button('Settings & accessibility');
  await shot('17-accessibility-settings');
  await nav('Overview');
  await page.setViewportSize({ width: 390, height: 844 });
  await shot('18-mobile-dashboard');
  await writeFile(
    `${output}/capture-manifest.json`,
    JSON.stringify(
      {
        source: 'Local production build; isolated fictional demo household',
        captures,
        browserErrors: errors,
      },
      null,
      2,
    ) + '\n',
  );
  if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
} catch (error) {
  await page.screenshot({ path: '.runtime/readme-capture-error.png', fullPage: true });
  throw error;
} finally {
  await browser.close();
}
