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
  await expect(page).not.toHaveURL(/\/login$/);
}

async function apiLogin(page: Page, email: string) {
  const response = await page.request.post(apiUrl('/api/v1/auth/login'), {
    data: { email, password: '123456' },
  });
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { data: { token: string } };
  return body.data.token;
}

test('staff transitions a ticket and the durable mock outbox remains observable', async ({
  page,
}) => {
  await login(page, 'staff@gmail.com');
  await expect(page).toHaveURL(/\/staff$/);

  await expect(page.getByText('呼び出し中').first()).toBeVisible();
  const calledEntry = page.getByRole('button', { name: /呼び出し中/ }).first();
  await expect(calledEntry).toBeEnabled();
  await calledEntry.click();
  await page.getByRole('button', { name: '対応開始' }).click();
  await expect(page.getByText('対応中').first()).toBeVisible();

  const staffToken = await apiLogin(page, 'staff@gmail.com');
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

  const managerToken = await apiLogin(page, 'manager@gmail.com');
  const deliveries = await page.request.get(apiUrl('/api/v1/notifications/operations?limit=100'), {
    headers: { Authorization: `Bearer ${managerToken}` },
  });
  expect(deliveries.ok()).toBeTruthy();
  const body = (await deliveries.json()) as {
    data: { items: Array<{ eventType: string; branchName: string; queueName: string }> };
  };
  expect(body.data.items.some((item) => item.eventType === 'called')).toBeTruthy();
  expect(body.data.items.every((item) => item.branchName === '東京本店')).toBeTruthy();
  expect(body.data.items.every((item) => item.queueName === '受付カウンターA')).toBeTruthy();

  const ownerToken = await apiLogin(page, 'manager2@gmail.com');
  const ownerDeliveries = await page.request.get(
    apiUrl('/api/v1/notifications/operations?limit=100'),
    { headers: { Authorization: `Bearer ${ownerToken}` } }
  );
  expect(ownerDeliveries.status()).toBe(403);
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
      termsAccepted: true,
    },
  });
  expect(applicationResponse.ok()).toBeTruthy();
  const applicationBody = (await applicationResponse.json()) as {
    data: { referenceCode: string };
  };
  expect(applicationBody.data.referenceCode).toMatch(/^SQA-/);

  await login(page, 'admin@gmail.com');
  await page.goto('/admin/applications');
  const applicationRow = page.locator('article').filter({ hasText: tradeName });
  await expect(applicationRow).toHaveCount(1);
  await expect(applicationRow).toContainText(tradeName);
  await applicationRow.click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '承認して組織を作成' }).click();

  await expect(page.getByText('組織と管理者アカウントを作成しました。')).toBeVisible();
});

test('admin operational health is sanitized and unavailable to branch staff', async ({ page }) => {
  const adminToken = await apiLogin(page, 'admin@gmail.com');
  const health = await page.request.get(apiUrl('/api/v1/admin/operations/health'), {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  expect(health.ok()).toBeTruthy();
  const body = (await health.json()) as {
    data: {
      components: { payment: { mode: string; provider: string; status: string } };
    };
  };
  expect(body.data.components.payment).toMatchObject({
    mode: 'demo',
    provider: 'demo',
    status: 'healthy',
  });
  expect(JSON.stringify(body.data)).not.toMatch(
    /customerName|lineUserId|organizationName|payload|channelSecret|accessToken/i
  );

  const staffToken = await apiLogin(page, 'staff@gmail.com');
  const forbidden = await page.request.get(apiUrl('/api/v1/admin/operations/health'), {
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  expect(forbidden.status()).toBe(403);
});

test('demo refund is server-side and idempotent for a completed paid order', async ({ page }) => {
  const staffToken = await apiLogin(page, 'staff@gmail.com');
  const headers = {
    Authorization: `Bearer ${staffToken}`,
    'Idempotency-Key': `e2e-refund-order-0001-${Date.now()}`,
  };
  const data = {
    paymentStatus: 'refunded',
    reason: 'E2E demo acceptance refund',
  };

  const first = await page.request.patch(
    apiUrl('/api/v1/orders/55555555-5555-4555-8555-555555555501/payment'),
    { headers, data }
  );
  const firstBody = (await first.json()) as { data?: { payment_status?: string }; error?: unknown };
  expect(first.ok(), JSON.stringify(firstBody)).toBeTruthy();
  expect(firstBody.data?.payment_status).toBe('refunded');
  const duplicate = await page.request.patch(
    apiUrl('/api/v1/orders/55555555-5555-4555-8555-555555555501/payment'),
    { headers, data }
  );
  const duplicateBody = (await duplicate.json()) as {
    data?: { payment_status?: string };
    error?: unknown;
  };
  expect(duplicate.ok(), JSON.stringify(duplicateBody)).toBeTruthy();
  expect(duplicateBody.data?.payment_status).toBe('refunded');

  const order = await page.request.get(
    apiUrl('/api/v1/orders/55555555-5555-4555-8555-555555555501'),
    { headers: { Authorization: `Bearer ${staffToken}` } }
  );
  const orderBody = (await order.json()) as {
    data: { payment_status: string };
    error?: { code?: string; message?: string };
  };
  expect(order.ok(), JSON.stringify(orderBody)).toBeTruthy();
  expect(orderBody.data.payment_status).toBe('refunded');
});

test('branch manager can inspect the branch QR and branch settings', async ({ page }) => {
  await login(page, 'manager@gmail.com');
  await page.goto('/manager/qr');
  await expect(page.getByRole('heading', { name: 'QRコード管理', exact: true })).toBeVisible();
  await expect(page.locator('.qr-frame svg')).toBeVisible();

  await page.goto('/manager/settings');
  await expect(page.getByRole('heading', { name: '支店設定' })).toBeVisible();
  await expect(page.getByText('営業時間')).toBeVisible();
});
