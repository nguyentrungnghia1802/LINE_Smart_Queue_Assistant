import { expect, test } from '@playwright/test';

test('login supports Japanese, English, and Vietnamese with a persisted locale choice', async ({
  page,
}) => {
  await page.goto('/login');

  const language = page.getByRole('combobox', { name: '言語' });
  await expect(page.getByRole('heading', { name: 'ログイン', exact: true })).toBeVisible();

  await language.selectOption('en');
  await expect(page.getByRole('heading', { name: 'Log in', exact: true })).toBeVisible();

  await page.getByRole('combobox', { name: 'Language' }).selectOption('vi');
  await expect(page.getByRole('heading', { name: 'Đăng nhập', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Đăng nhập', exact: true })).toBeVisible();
});
