import { expect, test } from '@playwright/test';

test('LIFF mock authenticates, pays required items, books, and opens the ticket', async ({
  page,
}) => {
  await page.goto('/liff/qr/demo-queue-lab-2026');

  await expect.poll(() => page.evaluate(() => localStorage.getItem('auth_token'))).not.toBeNull();
  await expect(page.getByRole('heading', { name: '商品 / サービス' })).toBeVisible();

  await page.getByRole('button', { name: 'ヘアカラー を追加' }).click();
  await page.getByRole('button', { name: 'ピーチティー を追加' }).click();
  await page.getByLabel('お名前（任意）').fill('山田 花子');
  await page.getByLabel('電話番号（任意）').fill('09012345678');

  await page.getByRole('button', { name: '事前支払いへ進む' }).click();
  await expect(page).toHaveURL(/\/liff\/checkout\/demo\//);
  await expect(page.getByRole('heading', { name: 'お支払い' })).toBeVisible();
  await expect(page.getByRole('button', { name: '必須分のみ' })).toBeVisible();
  await page.getByRole('button', { name: /クレジットカードで支払う/ }).click();

  await expect(page).toHaveURL(/\/liff\/qr\/demo-queue-lab-2026$/);
  await expect(page.getByText('必須分支払い済み')).toBeVisible();
  await page.getByRole('button', { name: '予約する' }).click();

  await expect(page).toHaveURL(/\/liff\/tickets\/[0-9a-f-]+$/);
  await expect(page.getByText('受付番号', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/[A-Z]+\d{3}/).first()).toBeVisible();
});

test('LIFF home resolves the authenticated customer and booking navigation', async ({ page }) => {
  await page.goto('/liff/home');

  await expect(page.getByText('E2Eテストユーザー')).toBeVisible();
  await page.getByRole('button', { name: '予約する' }).click();
  await expect(page).toHaveURL(/\/liff\/qr\/demo-queue-lab-2026$/);
});
