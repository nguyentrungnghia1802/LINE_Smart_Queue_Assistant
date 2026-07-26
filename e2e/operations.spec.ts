import { expect, type Page, test } from '@playwright/test';

const E2E_API_ORIGIN = process.env['E2E_API_ORIGIN'] ?? 'http://127.0.0.1:4100';

function apiUrl(path: string) {
  return `${E2E_API_ORIGIN}${path}`;
}

async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/login');
  await page.getByLabel('メール').fill(email);
  await page.getByRole('textbox', { name: 'パスワード' }).fill('123456');
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
    apiUrl('/api/v1/staff/entries/66666666-6666-4666-8666-666666666503/serve'),
    { headers: { Authorization: `Bearer ${staffToken}` } }
  );
  expect(seededServing.ok() || seededServing.status() === 409).toBeTruthy();
  const receipt = await page.request.get(
    apiUrl('/api/v1/orders/55555555-5555-4555-8555-555555555501/receipt'),
    {
      headers: { Authorization: `Bearer ${staffToken}` },
    }
  );
  expect(receipt.ok()).toBeTruthy();

  const managerLogin = await page.request.post(apiUrl('/api/v1/auth/login'), {
    data: { email: 'manager@gmail.com', password: '123456' },
  });
  expect(managerLogin.ok()).toBeTruthy();
  const managerBody = (await managerLogin.json()) as { data: { token: string } };
  const managerToken = managerBody.data.token;
  const deliveries = await page.request.get(apiUrl('/api/v1/notifications/operations?limit=100'), {
    headers: { Authorization: `Bearer ${managerToken}` },
  });
  expect(deliveries.ok()).toBeTruthy();
  const body = (await deliveries.json()) as { data: { items: Array<{ eventType: string }> } };
  expect(body.data.items.some((item) => item.eventType === 'serving')).toBeTruthy();
});

test('a public business application is provisioned only after admin approval', async ({ page }) => {
  const unique = Date.now();
  const tradeName = `E2E受付${unique}`;
  const applicationResponse = await page.request.post(apiUrl('/api/v1/organization-applications'), {
    data: {
      legalName: `E2E株式会社${unique}`,
      tradeName,
      businessType: 'salon',
      registrationNumber: null,
      websiteUrl: null,
      contactName: 'E2E管理者',
      contactTitle: null,
      workEmail: `owner.${unique}@example.jp`,
      phone: '0312345678',
      postalCode: '100-0001',
      prefecture: '東京都',
      city: '千代田区',
      addressLine1: '千代田1-1',
      addressLine2: null,
      locationCount: 1,
      expectedMonthlyCustomers: 500,
      planCode: 'starter',
      billingCycle: 'monthly',
      defaultLocale: 'ja',
      logoUrl: null,
      password: 'SecurePass123!',
      termsAccepted: true,
    },
  });
  expect(applicationResponse.ok()).toBeTruthy();
  const applicationBody = (await applicationResponse.json()) as {
    data: { referenceCode: string };
  };

  await login(page, 'admin@gmail.com');
  await page.goto('/admin/applications');
  const applicationRow = page
    .locator('article')
    .filter({ hasText: applicationBody.data.referenceCode });
  await expect(applicationRow.getByText(tradeName)).toBeVisible();
  await applicationRow.getByRole('button', { name: '審査する' }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '承認して組織を作成' }).click();

  await expect(page.getByText('組織と管理者アカウントを作成しました。')).toBeVisible();
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
