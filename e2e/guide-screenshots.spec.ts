import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

import { expect, type Locator, type Page, test } from '@playwright/test';

import { admin as jaAdmin } from '../apps/web/src/i18n/locales/ja/admin';
import { auth as jaAuth } from '../apps/web/src/i18n/locales/ja/auth';
import { common as jaCommon } from '../apps/web/src/i18n/locales/ja/common';
import { customer as jaCustomer } from '../apps/web/src/i18n/locales/ja/customer';
import { manager as jaManager } from '../apps/web/src/i18n/locales/ja/manager';
import { marketing as jaMarketing } from '../apps/web/src/i18n/locales/ja/marketing';
import { staff as jaStaff } from '../apps/web/src/i18n/locales/ja/staff';

const DESKTOP = { width: 1440, height: 1000 };
const MOBILE = { width: 390, height: 844 };
const IMAGE_DIR = path.resolve(process.cwd(), 'docs/images/guide');
const DEMO_PASSWORD = '123456';
const ACTIVATION_TOKEN = 'guide-activation-token-2026-safe-local';

test.describe.configure({ mode: 'serial' });

test.beforeAll(() => {
  rmSync(IMAGE_DIR, { recursive: true, force: true });
  mkdirSync(IMAGE_DIR, { recursive: true });
});

test.beforeEach(async ({ context, page }) => {
  await context.addInitScript(() => {
    window.localStorage.setItem('line-queue-locale', 'ja');
  });
  await page.setViewportSize(DESKTOP);
});

async function settle(page: Page): Promise<void> {
  await expect(page.locator('body')).toBeVisible();
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(async () => {
    if ('fonts' in document) await document.fonts.ready;
  });
}

async function capture(page: Page, filename: string): Promise<void> {
  await settle(page);
  const localeSwitcher = page.locator('select:has(option[value="ja"])').first();
  if ((await localeSwitcher.count()) > 0 && (await localeSwitcher.isVisible())) {
    await expect(localeSwitcher).toHaveValue('ja');
  }
  await page.screenshot({
    path: path.join(IMAGE_DIR, filename),
    animations: 'disabled',
    caret: 'hide',
  });
}

async function captureNear(page: Page, locator: Locator, filename: string): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -110));
  await capture(page, filename);
}

async function resetBrowserSession(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('line-queue-locale', 'ja');
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: jaAuth.login.title, exact: true })).toBeVisible();
}

async function useJapanese(page: Page): Promise<void> {
  const switcher = page.locator('select').first();
  await expect(switcher).toBeVisible();
  if ((await switcher.inputValue()) !== 'ja') {
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/users/me') && response.request().method() === 'PATCH'
      ),
      switcher.selectOption('ja'),
    ]);
  }
  await expect(switcher).toHaveValue('ja');
}

async function loginBusiness(page: Page, email: string): Promise<void> {
  await resetBrowserSession(page);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: jaAuth.login.submit, exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
  await expect(page.locator('h1').first()).toBeVisible();
  await useJapanese(page);
}

test('public registration, admin review, and owner activation screens', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Smart Queue Assistant' })).toBeVisible();
  await capture(page, '01-landing-page.png');

  await page.getByRole('link', { name: jaMarketing.nav.businessSignup }).first().click();
  await expect(page).toHaveURL(/\/business\/register$/);
  await capture(page, '02-business-registration-start.png');

  await page.locator('[name="legalName"]').fill('株式会社ガイドレビュー');
  await page.locator('[name="tradeName"]').fill('ガイドレビュー受付');
  await page.locator('[name="businessType"]').selectOption('salon');
  await page.locator('[name="registrationNumber"]').fill('T9876543210123');
  await page.locator('[name="websiteUrl"]').fill('https://registration.guide.invalid');
  await page.locator('[name="contactName"]').fill('山田 レビュー');
  await page.locator('[name="contactTitle"]').fill('店舗責任者');
  await page.locator('[name="workEmail"]').fill('business.registration@guide.invalid');
  await page.locator('[name="phone"]').fill('0312345678');
  await page.locator('[name="postalCode"]').fill('100-0001');
  await page.locator('[name="prefecture"]').fill('東京都');
  await page.locator('[name="city"]').fill('千代田区');
  await page.locator('[name="addressLine1"]').fill('千代田1-1');
  await capture(page, '03-business-registration-form.png');

  await page.getByRole('button', { name: jaMarketing.registration.next }).click();
  await page.locator('[name="locationCount"]').fill('2');
  await page.locator('[name="expectedMonthlyCustomers"]').fill('1200');
  await page.locator('[name="planCode"][value="standard"]').check({ force: true });
  await capture(page, '04-business-registration-plan.png');

  await page.getByRole('button', { name: jaMarketing.registration.next }).click();
  await page.locator('[name="termsAccepted"]').check();
  await page.getByRole('button', { name: jaMarketing.registration.submit }).click();
  await expect(
    page.getByRole('heading', { name: jaMarketing.registration.success.title })
  ).toBeVisible();
  await capture(page, '05-business-registration-complete.png');

  await resetBrowserSession(page);
  await capture(page, '06-admin-login.png');
  await page.locator('input[name="email"]').fill('admin@gmail.com');
  await page.locator('input[name="password"]').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: jaAuth.login.submit, exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: jaAdmin.dashboard.title })).toBeVisible();
  await capture(page, '07-admin-dashboard.png');

  await page.goto('/admin/applications');
  await expect(page.getByText('ガイドスマート受付')).toBeVisible();
  await capture(page, '08-admin-applications.png');
  const guideApplication = page.getByRole('button', { name: /ガイドスマート受付/ });
  await guideApplication.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await capture(page, '09-admin-application-detail.png');

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: jaAdmin.applications.approve }).click();
  await expect(page.getByText(jaAdmin.applications.approveSuccess)).toBeVisible();
  await capture(page, '10-admin-application-approval.png');

  await resetBrowserSession(page);
  await page.goto(`/activate-account?token=${ACTIVATION_TOKEN}`);
  await expect(page.getByRole('heading', { name: jaAuth.lifecycle.activate.title })).toBeVisible();
  await expect(page.getByText(/ow\*\*\*@guide\.invalid/)).toBeVisible();
  await capture(page, '11-owner-activation.png');
});

test('organization owner screens', async ({ page }) => {
  await loginBusiness(page, 'manager2@gmail.com');
  await expect(page).toHaveURL(/\/manager$/);
  await capture(page, '12-owner-dashboard.png');

  await page.goto('/manager/products');
  await expect(page.locator('h1').first()).toBeVisible();
  await expect(page.getByRole('cell', { name: 'DV1', exact: true })).toBeVisible();
  await capture(page, '13-owner-product-catalog.png');

  await page.goto('/manager/products/new');
  await expect(page.getByRole('heading', { name: jaManager.products.create })).toBeVisible();
  await capture(page, '14-owner-create-product.png');

  await page.goto('/manager/branches');
  await expect(page.getByRole('heading', { name: jaManager.branches.title })).toBeVisible();
  await capture(page, '15-owner-branches.png');
  await page.getByRole('button', { name: jaManager.branches.add }).click();
  await expect(page.getByRole('heading', { name: jaManager.branches.formTitle })).toBeVisible();
  await capture(page, '16-owner-create-branch.png');
  await page.getByRole('button', { name: jaManager.branches.cancel }).click();

  const mainBranch = page.locator('article').filter({ hasText: '東京本店' });
  await mainBranch.getByRole('button', { name: jaManager.branches.addManager }).click();
  await expect(page.getByRole('heading', { name: jaManager.branches.inviteManager })).toBeVisible();
  await capture(page, '17-owner-branch-managers.png');
  await page.getByRole('button', { name: jaManager.branches.cancel }).click();

  await page.goto('/manager/audit');
  await expect(page.getByRole('heading', { name: jaManager.audit.title })).toBeVisible();
  await capture(page, '18-owner-audit.png');
});

test('branch manager screens', async ({ page }) => {
  await loginBusiness(page, 'manager@gmail.com');
  await expect(page).toHaveURL(/\/manager$/);
  await capture(page, '19-branch-manager-dashboard.png');

  await page.goto('/manager/settings');
  await expect(page.getByRole('heading', { name: jaManager.settings.branchTitle })).toBeVisible();
  await capture(page, '20-branch-settings.png');
  await captureNear(
    page,
    page.getByRole('heading', { name: jaManager.settings.businessHours }),
    '21-business-calendar.png'
  );

  await page.goto('/manager/queues');
  await expect(page.getByRole('heading', { name: jaCommon.nav.queue })).toBeVisible();
  await capture(page, '22-queue-list.png');

  await page.goto('/manager/queues/new');
  await expect(page.getByRole('heading', { name: jaManager.queue.createTitle })).toBeVisible();
  await page.locator('[name="name"]').fill('Quầy kiểm thử hướng dẫn');
  await page.locator('[name="prefix"]').fill('G');
  await page.locator('[name="maxCapacity"]').fill('30');
  await capture(page, '23-create-queue.png');
  const productPicker = page
    .locator('input[name="queueProductSearch"]')
    .locator('..')
    .locator('..');
  await page.getByRole('checkbox').nth(0).check();
  await page.getByRole('checkbox').nth(1).check();
  await captureNear(page, productPicker, '24-queue-product-assignment.png');

  await page.goto('/manager/products');
  await expect(page.getByRole('cell', { name: 'SP2', exact: true })).toBeVisible();
  await capture(page, '25-branch-stock.png');

  await page.goto('/manager/users');
  await expect(page.getByRole('heading', { name: jaManager.users.title })).toBeVisible();
  await capture(page, '26-staff-list.png');
  await page.getByRole('button', { name: jaManager.users.add }).click();
  await expect(page.getByRole('heading', { name: jaManager.users.add })).toBeVisible();
  await capture(page, '27-invite-staff.png');
  await page.getByRole('button', { name: jaCommon.actions.cancel }).click();

  await page.goto('/manager/qr');
  await expect(page.getByRole('heading', { name: jaManager.qr.title })).toBeVisible();
  await expect(page.locator('svg').first()).toBeVisible();
  await capture(page, '28-branch-qr.png');
});

test('customer Mock LIFF booking and Demo Payment screens', async ({ page }) => {
  await resetBrowserSession(page);
  await page.setViewportSize(MOBILE);

  await page.goto('/liff/home');
  await expect(page.getByText('LINEデモ顧客')).toBeVisible();
  await useJapanese(page);
  await capture(page, '29-liff-home-mobile.png');

  await page.goto('/liff/qr/demo-queue-lab-2026');
  await expect(page.getByRole('heading', { name: '東京本店' })).toBeVisible();
  await useJapanese(page);
  await expect(page.getByText(jaCustomer.booking.selectQueue)).toBeVisible();
  await capture(page, '30-customer-queue-selection-mobile.png');
  await page
    .getByRole('combobox', { name: jaCustomer.booking.selectQueue })
    .selectOption({ label: '受付カウンターA' });
  await expect(page.getByRole('heading', { name: jaCustomer.booking.productsTitle })).toBeVisible();
  await expect(page.getByText('ヘアカット').first()).toBeVisible();
  await capture(page, '31-customer-catalog-mobile.png');

  await page
    .getByRole('button', {
      name: jaCustomer.booking.openProductDetails.replace('{{name}}', 'ヘアカット'),
    })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await capture(page, '32-product-detail-mobile.png');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: jaCommon.actions.close })
    .last()
    .click();

  await page
    .getByRole('button', {
      name: jaCustomer.booking.increaseItem.replace('{{name}}', 'ヘアカット'),
    })
    .click();
  await page.getByLabel(jaCustomer.booking.nameRequiredLabel).fill('山田 花子');
  await page.getByLabel(jaCustomer.booking.phoneRequiredLabel).fill('09012345678');
  await captureNear(
    page,
    page.getByRole('heading', { name: jaCustomer.booking.receptionDetails }),
    '33-customer-booking-form-mobile.png'
  );
  await page.getByRole('button', { name: jaCustomer.booking.book, exact: true }).click();
  await expect(page).toHaveURL(/\/liff\/tickets\/[0-9a-f-]+$/);
  await expect(page.getByText(jaCommon.labels.ticketCode, { exact: true }).first()).toBeVisible();

  await page.goto('/liff/qr/demo-queue-lab-2026');
  await expect(page.getByRole('heading', { name: '東京本店' })).toBeVisible();
  await useJapanese(page);
  const queueSelect = page.getByRole('combobox', { name: jaCustomer.booking.selectQueue });
  if ((await queueSelect.inputValue()) === '') {
    await queueSelect.selectOption({ label: '受付カウンターA' });
  }
  await page
    .getByRole('button', {
      name: jaCustomer.booking.increaseItem.replace('{{name}}', 'ヘアカラー'),
    })
    .click();
  await page.getByLabel(jaCustomer.booking.nameRequiredLabel).fill('山田 花子');
  await page.getByLabel(jaCustomer.booking.phoneRequiredLabel).fill('09012345678');
  await page.getByRole('button', { name: jaCustomer.booking.payAndBook }).click();
  await expect(page).toHaveURL(/\/liff\/checkout\/demo\//);
  await expect(page.getByRole('heading', { name: jaCustomer.payment.title })).toBeVisible();
  await capture(page, '34-demo-payment-mobile.png');

  await page
    .getByRole('button', { name: jaCustomer.payment.methods.creditCard.label, exact: true })
    .last()
    .click();
  await expect(page).toHaveURL(/\/liff\/tickets\/[0-9a-f-]+$/);
  await expect(page.getByText(jaCommon.labels.ticketCode, { exact: true }).first()).toBeVisible();
  await capture(page, '35-booking-success-mobile.png');
  await captureNear(
    page,
    page.getByText(jaCustomer.orderDetails.orderNumber, { exact: true }).first(),
    '36-customer-ticket-mobile.png'
  );

  await page.goto('/liff/history');
  await useJapanese(page);
  await expect(page.getByRole('heading', { name: jaCustomer.history.title })).toBeVisible();
  await capture(page, '37-customer-booking-history-mobile.png');

  await page.goto('/liff/preferences');
  await useJapanese(page);
  await expect(page.getByRole('heading', { name: jaCustomer.preferences.pageTitle })).toBeVisible();
  await capture(page, '38-customer-line-preferences-mobile.png');
});

test('staff queue lifecycle, defer, completion, and receipt screens', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await resetBrowserSession(page);
  await page.locator('input[name="email"]').fill('staff@gmail.com');
  await capture(page, '39-staff-login.png');
  await page.locator('input[name="password"]').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: jaAuth.login.submit, exact: true }).click();
  await expect(page).toHaveURL(/\/staff$/);
  await expect(page.getByRole('button', { name: /^A004 / })).toBeVisible();
  await capture(page, '40-staff-workspace-desktop.png');

  await page.setViewportSize(MOBILE);
  await capture(page, '41-staff-workspace-mobile.png');
  await page.setViewportSize(DESKTOP);

  await page.getByRole('button', { name: /^A003 / }).click();
  await expect(page.getByText(jaCommon.states.called).first()).toBeVisible();
  await capture(page, '42-ticket-called.png');

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: jaStaff.dashboard.defer }).click();
  await expect(page.getByRole('button', { name: /^A003 / })).toContainText(jaCommon.states.waiting);
  await capture(page, '46-absence-defer.png');

  await page.getByRole('button', { name: /^A004 / }).click();
  await expect(page.getByText(jaCommon.states.serving).first()).toBeVisible();
  await capture(page, '43-ticket-serving.png');
  await page.getByRole('button', { name: jaStaff.dashboard.complete, exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await capture(page, '44-ticket-completed.png');

  const receiptPagePromise = page.context().waitForEvent('page');
  await page.getByRole('button', { name: jaStaff.dashboard.printReceipt }).click();
  const receiptPage = await receiptPagePromise;
  await receiptPage.setViewportSize(DESKTOP);
  await expect(
    receiptPage.getByRole('heading', { name: jaStaff.dashboard.printReceipt })
  ).toBeVisible();
  await capture(receiptPage, '45-receipt.png');
  await receiptPage.close();
});
