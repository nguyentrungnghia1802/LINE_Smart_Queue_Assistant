import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { i18n } from '../../../i18n';
import { get, patch, post } from '../../../services/apiClient';
import { AdminOrganizationDetailPage } from '../AdminOrganizationDetailPage';
import type { OrgRow } from '../AdminOrganizationsPage';

vi.mock('../../../services/apiClient', () => ({
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
}));

const getMock = vi.mocked(get);
const patchMock = vi.mocked(patch);
const postMock = vi.mocked(post);

const activeOrganization: OrgRow = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Tokyo Clinic',
  slug: 'tokyo-clinic',
  public_qr_token: 'public-token',
  logo_url: null,
  phone: '0312345678',
  address: 'Tokyo',
  payment_info: null,
  default_locale: 'ja',
  subscription_plan: 'starter',
  is_active: true,
  activation_status: 'active',
  suspension_reason: null,
  suspension_note: null,
};

const owner = {
  id: '22222222-2222-4222-8222-222222222222',
  display_name: 'Clinic Owner',
  email: 'owner@example.jp',
  account_status: 'active',
  is_active: true,
};

function renderPage(organization: OrgRow) {
  getMock.mockImplementation(async (url) =>
    String(url).endsWith('/managers') ? [owner] : [organization]
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[`/admin/orgs/${organization.id}`]}>
      <QueryClientProvider client={client}>
        <Routes>
          <Route path="/admin/orgs/:orgId" element={<AdminOrganizationDetailPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe('AdminOrganizationDetailPage suspension', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ja');
    getMock.mockReset();
    patchMock.mockReset();
    postMock.mockReset().mockResolvedValue({
      activationStatus: 'suspended',
    });
  });

  it('collects a suspension reason and optional note before suspending', async () => {
    const user = userEvent.setup();
    renderPage(activeOrganization);

    await user.click(await screen.findByRole('button', { name: '利用を停止' }));
    await user.selectOptions(
      screen.getByRole('combobox', { name: '停止理由' }),
      'organization_request'
    );
    await user.type(
      screen.getByRole('textbox', { name: '追記事項' }),
      'Requested by the organization owner'
    );
    await user.click(screen.getByRole('button', { name: '利用停止を確定' }));

    expect(postMock).toHaveBeenCalledWith(
      `/api/v1/admin/organizations/${activeOrganization.id}/suspend`,
      {
        reason: 'organization_request',
        note: 'Requested by the organization owner',
      }
    );
  });

  it('shows the stored status, reason, and note for a suspended organization', async () => {
    renderPage({
      ...activeOrganization,
      is_active: false,
      activation_status: 'suspended',
      suspension_reason: 'contract_renewal_cancelled',
      suspension_note: 'Contract ended on 31 August',
    });

    expect(await screen.findByRole('heading', { name: 'Tokyo Clinic' })).toBeInTheDocument();
    expect(screen.getAllByText('利用停止中').length).toBeGreaterThan(0);
    expect(screen.getByText('契約更新のキャンセル')).toBeInTheDocument();
    expect(screen.getByText('Contract ended on 31 August')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '利用を停止' })).not.toBeInTheDocument();
  });

  it('truncates organization names longer than 40 characters in the detail heading', async () => {
    const visiblePrefix = '1234567890123456789012345678901234567890';
    const longName = `${visiblePrefix}Extended organization name`;
    renderPage({ ...activeOrganization, name: longName });

    const heading = await screen.findByRole('heading', { name: longName });
    expect(heading).toHaveTextContent(`${visiblePrefix}...`);
    expect(heading).toHaveAttribute('title', longName);
  });
});
