import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BusinessRegistrationPage } from '../BusinessRegistrationPage';

const { mockPost } = vi.hoisted(() => ({ mockPost: vi.fn() }));

vi.mock('../../../services/apiClient', async () => {
  const actual = await vi.importActual<typeof import('../../../services/apiClient')>(
    '../../../services/apiClient'
  );
  return { ...actual, post: mockPost };
});

describe('BusinessRegistrationPage', () => {
  beforeEach(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    mockPost.mockReset();
    mockPost.mockResolvedValue({
      referenceCode: 'SQA-A1B2C3D4',
      paymentStatus: 'paid',
      amountYen: 298_000,
    });
  });

  it('submits a work email application without a browser-supplied slug', async () => {
    render(
      <MemoryRouter initialEntries={['/business/register?plan=standard']}>
        <BusinessRegistrationPage />
      </MemoryRouter>
    );

    fill('法人名・屋号（正式名称）', 'Tokyo Service Company');
    fill('店舗・サービス名', 'Smart Reception Tokyo');
    fill('担当者名', '田中 由紀');
    fill(/会社メールアドレス/, 'owner@example.jp');
    fill('電話番号', '0312345678');
    fill('郵便番号', '100-0001');
    fill('都道府県', '東京都');
    fill('市区町村', '千代田区');
    fill('番地・建物名', '千代田1-1');
    fireEvent.click(screen.getByRole('button', { name: '次へ' }));

    fill(/管理者パスワード/, 'secure-password');
    fireEvent.click(screen.getByRole('button', { name: '次へ' }));

    fireEvent.click(
      screen.getByRole('checkbox', {
        name: /利用規約とプライバシーポリシーに同意/,
      })
    );
    fireEvent.click(screen.getByRole('button', { name: 'デモ決済して申し込む' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    const payload = mockPost.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload).toMatchObject({
      legalName: 'Tokyo Service Company',
      tradeName: 'Smart Reception Tokyo',
      workEmail: 'owner@example.jp',
      planCode: 'standard',
      termsAccepted: true,
    });
    expect(payload).not.toHaveProperty('slug');
    expect(await screen.findByText('審査を受け付けました')).toBeInTheDocument();
  });
});

function fill(label: string | RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
