// Rasterize the existing vector brand mark; do not introduce a second logo.
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const svg = readFileSync('public/favicon.svg', 'utf8').replace('rx="18"', 'rx="0"');
mkdirSync('public/icons', { recursive: true });
const browser = await chromium.launch({
  channel: process.platform === 'win32' ? 'chrome' : undefined,
});
try {
  const page = await browser.newPage();
  for (const [name, size] of [
    ['icon-192', 192],
    ['icon-512', 512],
    ['maskable-512', 512],
    ['apple-touch-icon', 180],
  ]) {
    const data = await page.evaluate(
      async ({ svg, size }) => {
        const img = new Image();
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const context = canvas.getContext('2d');
        context.drawImage(img, 0, 0, size, size);
        return canvas.toDataURL('image/png').split(',')[1];
      },
      { svg, size },
    );
    writeFileSync(`public/icons/${name}.png`, Buffer.from(data, 'base64'));
  }
} finally {
  await browser.close();
}
