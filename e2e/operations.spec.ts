import { expect, type Page, test } from '@playwright/test';

async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/login');
  await page.getByLabel('メール').fill(email);
  await page.getByLabel('パスワード').fill('123456');
  await page.getByRole('button', { name: 'ログイン', exact: true }).click();
  await expect.poll(() => token(page)).not.toBeNull();
}

async function token(page: Page) {
  return page.evaluate(() => localStorage.getItem('auth_token'));
}

test('staff transitions a ticket and LINE delivery stays on the durable mock outbox', async ({
  page,
}) => {
  await login(page, 'staff@gmail.com');
  await expect(page).toHaveURL(/\/staff$/);

  const callNext = page.getByRole('button', { name: '次の番号を呼び出す' });
  if (await callNext.isEnabled()) {
    await callNext.click();
  }
  await expect(page.getByText('呼び出し中').first()).toBeVisible();
  const calledEntry = page.getByRole('button', { name: /^[A-Z]+\d+\s+呼び出し中/ }).first();
  await expect(calledEntry).toBeEnabled();
  await calledEntry.click();
  await page.getByRole('button', { name: '対応開始' }).click();
  await expect(page.getByText('対応中').first()).toBeVisible();

  const staffToken = await token(page);
  expect(staffToken).toBeTruthy();
  const seededServing = await page.request.post(
    '/api/v1/staff/entries/66666666-6666-4666-8666-666666666503/serve',
    { headers: { Authorization: `Bearer ${staffToken}` } }
  );
  expect(seededServing.ok() || seededServing.status() === 409).toBeTruthy();
  const receipt = await page.request.get(
    '/api/v1/orders/55555555-5555-4555-8555-555555555501/receipt',
    {
      headers: { Authorization: `Bearer ${staffToken}` },
    }
  );
  expect(receipt.ok()).toBeTruthy();

  const managerLogin = await page.request.post('/api/v1/auth/login', {
    data: { email: 'manager@gmail.com', password: '123456' },
  });
  expect(managerLogin.ok()).toBeTruthy();
  const managerBody = (await managerLogin.json()) as { data: { token: string } };
  const managerToken = managerBody.data.token;
  const deliveries = await page.request.get('/api/v1/notifications/operations?limit=100', {
    headers: { Authorization: `Bearer ${managerToken}` },
  });
  expect(deliveries.ok()).toBeTruthy();
  const body = (await deliveries.json()) as { data: { items: Array<{ eventType: string }> } };
  expect(body.data.items.some((item) => item.eventType === 'serving')).toBeTruthy();
});

test('admin registers a new organization and manager through the dedicated page', async ({
  page,
}) => {
  await login(page, 'admin@gmail.com');
  await page.goto('/admin/orgs/register');

  const unique = Date.now();
  await page.getByLabel('組織名').fill(`E2E組織${unique}`);
  await page.getByLabel('スラッグ').fill(`e2e-org-${unique}`);
  await page.getByLabel('電話番号').fill('0312345678');
  await page.getByLabel('住所').fill('東京都千代田区丸の内1-1');
  await page.getByLabel('表示名').fill('E2Eマネージャー');
  await page.getByLabel('Gmail').fill(`e2e.manager.${unique}@gmail.com`);
  await page.getByLabel('パスワード').fill('SecurePass123!');
  await page.getByRole('button', { name: '組織を登録' }).click();

  await expect(page).toHaveURL(/\/admin\/orgs\/[0-9a-f-]+$/);
  await expect(page.getByText(`E2E組織${unique}`)).toBeVisible();
});

test('manager can inspect QR and organization settings', async ({ page }) => {
  await login(page, 'manager@gmail.com');
  await page.goto('/manager/qr');
  await expect(page.getByRole('heading', { name: 'QRコード管理', exact: true })).toBeVisible();
  await expect(page.locator('svg').first()).toBeVisible();

  await page.goto('/manager/settings');
  await expect(page.getByText('組織情報')).toBeVisible();
  await expect(page.getByRole('button', { name: '組織を保存' })).toBeVisible();
});
