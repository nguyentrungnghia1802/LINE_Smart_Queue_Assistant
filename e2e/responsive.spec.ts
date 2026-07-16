import { expect, test } from '@playwright/test';

test('staff board keeps its left queue rail and avoids horizontal page overflow', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('メール').fill('staff@gmail.com');
  await page.getByLabel('パスワード').fill('123456');
  await page.getByRole('button', { name: 'ログイン', exact: true }).click();
  await expect(page).toHaveURL(/\/staff$/);

  const layout = await page
    .locator('main')
    .first()
    .evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
      railLeft: document.querySelector('aside')?.getBoundingClientRect().left,
    }));
  expect(layout.content).toBeLessThanOrEqual(layout.viewport + 1);
  expect(layout.railLeft).toBe(0);
});

test('customer booking remains usable on a phone viewport', async ({ page }) => {
  await page.goto('/liff/qr/demo-queue-lab-2026');
  await expect(page.getByRole('heading', { name: '商品 / サービス' })).toBeVisible();
  await expect(page.getByRole('button', { name: '予約する' })).toBeVisible();
  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport + 1);
});
