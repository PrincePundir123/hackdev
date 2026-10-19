import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

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
