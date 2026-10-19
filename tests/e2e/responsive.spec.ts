import { test, expect } from '@playwright/test';

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1366, height: 640 },
]) {
  test(`dialog actions remain reachable at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.getByRole('button', { name: 'Continue as Meera' }).click();
    await expect(page.locator('.topbar')).toBeVisible();
    for (const [trigger, action] of [
      [/^Request help/, 'Confirm help request'],
      [/^Ask your companion$/, 'Review request'],
    ] as const) {
      await page.getByRole('button', { name: trigger }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveCSS('overflow-y', 'auto');
      // Exercise scrolling directly: automatic locator scrolling can mask clipped content.
      await dialog.evaluate((element) => element.scrollTo(0, element.scrollHeight));
      const button = dialog.getByRole('button', { name: action, exact: true });
      const bounds = await button.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
      await button.click({ trial: true });
      expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
        true,
      );
      await dialog.getByRole('button', { name: 'Close dialog' }).click();
    }
    // A reduced viewport approximates the space available above a software keyboard.
    await page.getByRole('button', { name: /^Request help/ }).click();
    await page.setViewportSize({ width: viewport.width, height: 320 });
    const dialog = page.getByRole('dialog');
    await dialog
      .getByRole('textbox', { name: 'How can your circle help?' })
      .fill('Responsive test');
    await dialog.evaluate((element) => element.scrollTo(0, element.scrollHeight));
    const created = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/incidents') && response.request().method() === 'POST',
    );
    await dialog.getByRole('button', { name: 'Confirm help request' }).click();
    const response = await created;
    expect(response.ok()).toBe(true);
    const incident = await response.json();
    try {
      await expect(dialog.getByText('Responsive test', { exact: true }).first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    } finally {
      const cancelled = await page.request.post(`/api/incidents/${incident.id}/respond`, {
        headers: { 'X-Saathi-Client': 'web' },
        data: { action: 'cancel' },
      });
      expect(cancelled.ok()).toBe(true);
    }
  });
}
