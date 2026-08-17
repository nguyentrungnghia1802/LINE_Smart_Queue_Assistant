import { expect, test } from '@playwright/test';

test('customer LINE login returns to the scanned booking route', async ({ page }) => {
  await page.goto('/login?returnTo=%2Fliff%2Fqr%2Fdemo-queue-lab-2026');

  await page.getByRole('link', { name: 'LINEで受付を始める' }).click();

  await expect(page).toHaveURL(/\/liff\/qr\/demo-queue-lab-2026$/);
  await expect(page.getByRole('heading', { name: '商品 / サービス' })).toBeVisible();
});

test('LIFF mock authenticates, pays required items, books, and opens the ticket', async ({
  page,
}) => {
  const friendshipResponsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/line/friendship') && response.request().method() === 'POST'
  );
  await page.goto('/liff/qr/demo-queue-lab-2026');

  const friendshipResponse = await friendshipResponsePromise;
  expect(friendshipResponse.ok(), await friendshipResponse.text()).toBeTruthy();

  await expect(page.getByRole('heading', { name: '商品 / サービス' })).toBeVisible();

  await page.getByRole('button', { name: 'ヘアカラー を追加' }).click();
  await page.getByRole('button', { name: 'ピーチティー を追加' }).click();
  await page.getByLabel('お名前（必須）').fill('山田 花子');
  await page.getByLabel('電話番号（必須）').fill('09012345678');

  await page.getByRole('button', { name: '支払いへ進んで予約する' }).click();
  await expect(page).toHaveURL(/\/liff\/checkout\/demo\//);
  await expect(page.getByRole('heading', { name: 'オンライン決済' })).toBeVisible();
  await expect(page.getByRole('button', { name: '必須分のみ' })).toBeVisible();
  await page.getByRole('button', { name: 'クレジットカード', exact: true }).click();

  await expect(page).toHaveURL(/\/liff\/tickets\/[0-9a-f-]+$/);
  await expect(page.getByText('受付番号', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/[A-Z]+\d{3}/).first()).toBeVisible();
  await expect(page.getByText('合計', { exact: true })).toBeVisible();
  await expect(page.getByText('お支払い済み', { exact: true })).toBeVisible();
  await expect(page.getByText('お支払い残額', { exact: true })).toBeVisible();
});

test('LIFF home resolves the authenticated customer and booking navigation', async ({ page }) => {
  await page.goto('/liff/home');

  await expect(page.getByText('E2Eテストユーザー')).toBeVisible();
  await page.getByRole('button', { name: '予約する' }).click();
  await expect(page).toHaveURL(/\/liff\/qr\/demo-queue-lab-2026$/);
});
