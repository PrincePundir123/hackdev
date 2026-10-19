import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('welcome headline and brand contrast with the dark panel on desktop and mobile', async ({
  page,
}) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
    { width: 320, height: 740 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const headline = page.locator('.auth-copy h1');
    await expect(headline).toBeVisible();
    await expect(headline).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(page.locator('.auth-story .brand')).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(page.locator('.auth-story')).toHaveCSS('background-color', 'rgb(0, 38, 77)');
    const panel = await page.locator('.auth-story').boundingBox();
    const title = await headline.boundingBox();
    expect(title!.x).toBeGreaterThanOrEqual(panel!.x);
    expect(title!.x + title!.width).toBeLessThanOrEqual(panel!.x + panel!.width);
    expect(title!.y + title!.height).toBeLessThanOrEqual(panel!.y + panel!.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});

test('entry, dashboard, and reminder dialog have no serious accessibility violations', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Continue as Meera' })).toBeVisible();
  const allIssues: unknown[] = [];
  for (const step of ['entry', 'dashboard', 'dialog']) {
    if (step === 'dashboard') {
      await page.getByRole('button', { name: 'Continue as Meera' }).click();
      await expect(page.getByRole('heading', { name: /Good .*, Meera/ })).toBeVisible();
    }
    if (step === 'dialog') {
      await page.getByRole('button', { name: 'Ask your companion' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
    }
    const scan = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    const issues = scan.violations
      .filter((v) => v.impact === 'critical' || v.impact === 'serious')
      .map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
      }));
    if (issues.length) allIssues.push({ step, issues });
  }
  expect(allIssues, 'Accessibility violations across the main interaction').toEqual([]);
});
