import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { i18n } from '../../../i18n';
import { get } from '../../../services/apiClient';
import { AdminOrganizationsPage, type OrgRow } from '../AdminOrganizationsPage';

vi.mock('../../../services/apiClient', () => ({ get: vi.fn() }));

const getMock = vi.mocked(get);

const organizations: OrgRow[] = [
  organization({ id: 'active-org', name: 'Active Organization', activation_status: 'active' }),
  organization({
    id: 'suspended-org',
    name: 'Suspended Organization',
    is_active: false,
    activation_status: 'suspended',
    suspension_reason: 'organization_request',
  }),
  organization({
    id: 'pending-org',
    name: 'Pending Organization',
    is_active: false,
    activation_status: 'pending_activation',
  }),
];

function organization(overrides: Partial<OrgRow>): OrgRow {
  return {
    id: 'organization-id',
    name: 'Organization',
    slug: 'organization',
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
    ...overrides,
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <AdminOrganizationsPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe('AdminOrganizationsPage status filters', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ja');
    getMock.mockReset().mockResolvedValue(organizations);
  });

  it('shows active organizations by default', async () => {
    renderPage();

    expect(await screen.findByText('Active Organization')).toBeInTheDocument();
    expect(screen.queryByText('Suspended Organization')).not.toBeInTheDocument();
    expect(screen.queryByText('Pending Organization')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '稼働中' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('switches between suspended and all organizations', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Active Organization');

    await user.click(screen.getByRole('button', { name: '利用停止中' }));
    expect(await screen.findByText('Suspended Organization')).toBeInTheDocument();
    expect(screen.queryByText('Active Organization')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'すべて' }));
    expect(await screen.findByText('Active Organization')).toBeInTheDocument();
    expect(screen.getByText('Suspended Organization')).toBeInTheDocument();
    expect(screen.getByText('Pending Organization')).toBeInTheDocument();
  });
});
