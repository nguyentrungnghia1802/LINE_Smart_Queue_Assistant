import { expect, test } from '@playwright/test';

test('staff board reflows its queue selector and avoids horizontal page overflow', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('メール').fill('staff@gmail.com');
  await page.locator('#password').fill('123456');
  await page.getByRole('button', { name: 'ログイン', exact: true }).click();
  await expect(page).toHaveURL(/\/staff$/);

  const layout = await page
    .locator('main')
    .first()
    .evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
      selector: document.querySelector('aside')?.getBoundingClientRect().toJSON(),
      detail: document.querySelectorAll('main')[1]?.getBoundingClientRect().toJSON(),
    }));
  expect(layout.content).toBeLessThanOrEqual(layout.viewport + 1);
  expect(layout.selector?.left).toBe(0);
  if ((page.viewportSize()?.width ?? 0) < 768) {
    expect(layout.selector?.width).toBeGreaterThan(layout.viewport * 0.9);
    expect(layout.detail?.top).toBeGreaterThanOrEqual((layout.selector?.bottom ?? 0) - 1);
  } else {
    expect(layout.detail?.left).toBeGreaterThanOrEqual((layout.selector?.right ?? 0) - 1);
  }
});

test('manager keeps every primary destination available at the active viewport', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('メール').fill('manager@gmail.com');
  await page.locator('#password').fill('123456');
  await page.getByRole('button', { name: 'ログイン', exact: true }).click();
  await expect(page).toHaveURL(/\/manager$/);

  const activeNavigation = page.locator('nav:visible').filter({
    has: page.getByRole('link', { name: 'ダッシュボード' }),
  });
  await expect(activeNavigation).toHaveCount(1);

  for (const label of ['ダッシュボード', 'キュー', 'スタッフ', 'QR表示', '設定']) {
    await expect(activeNavigation.getByRole('link', { name: label, exact: true })).toBeVisible();
  }
  await expect(activeNavigation.getByRole('link', { name: '商品', exact: true })).toHaveCount(0);

  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport + 1);
});

test('admin destinations remain available without horizontal overflow', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('メール').fill('admin@gmail.com');
  await page.locator('#password').fill('123456');
  await page.getByRole('button', { name: 'ログイン', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);

  const activeNavigation = page.locator('nav:visible').filter({
    has: page.getByRole('link', { name: 'ダッシュボード' }),
  });
  await expect(activeNavigation.getByRole('link', { name: 'ダッシュボード' })).toBeVisible();
  await expect(activeNavigation.getByRole('link', { name: '組織' })).toBeVisible();

  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport + 1);
});

test('customer booking remains usable on a phone viewport', async ({ page }) => {
  await page.goto('/liff/qr/demo-queue-lab-2026');
  await expect(page.getByRole('heading', { name: '商品 / サービス' })).toBeVisible();
  await page.getByRole('button', { name: 'ヘアカット を追加' }).click();
  await expect(page.getByRole('button', { name: '予約する' })).toBeVisible();
  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport + 1);
});
