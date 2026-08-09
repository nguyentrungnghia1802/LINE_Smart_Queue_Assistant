import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserRole } from '@line-queue/shared';

import { get, patch } from '../../../services/apiClient';
import { uploadImage } from '../../../services/media.api';
import { useAuthStore } from '../../../store/authStore';
import { compressLogoFile } from '../../../utils/compressLogoFile';
import { ManagerSettingsPage } from '../ManagerSettingsPage';

vi.mock('../../../services/apiClient', () => ({
  get: vi.fn(),
  patch: vi.fn(),
}));
vi.mock('../../../services/media.api', () => ({ uploadImage: vi.fn() }));
vi.mock('../../../utils/compressLogoFile', () => ({ compressLogoFile: vi.fn() }));

const organization = {
  name: 'Test Organization',
  logoUrl: null,
  phone: null,
  postalCode: null,
  prefecture: null,
  city: null,
  addressLine1: null,
  addressLine2: null,
  defaultLocale: 'ja' as const,
};

describe('ManagerSettingsPage organization logo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(get).mockResolvedValue(organization);
    vi.mocked(patch).mockResolvedValue({});
    vi.mocked(compressLogoFile).mockResolvedValue('data:image/jpeg;base64,AAAA');
    useAuthStore.setState({
      user: {
        id: 'owner-id',
        role: UserRole.MANAGER,
        organizationId: 'organization-id',
        displayName: 'Owner',
        email: 'owner@example.com',
      },
      token: 'token',
      isAuthenticated: true,
      isInitialized: true,
    });
  });

  it('stores the same-origin URL returned by the media upload endpoint', async () => {
    const uploadedUrl = '/media/organization_logo/2026-08-02/logo.webp';
    vi.mocked(uploadImage).mockResolvedValue({
      id: 'asset-id',
      public_url: uploadedUrl,
      content_type: 'image/webp',
      byte_size: 1_024,
    });
    renderPage();
    await screen.findByDisplayValue('Test Organization');

    const input = screen.getByLabelText('組織ロゴ');
    fireEvent.change(input, {
      target: { files: [new File(['logo'], 'logo.png', { type: 'image/png' })] },
    });

    await waitFor(() => expect(uploadImage).toHaveBeenCalled());
    expect(screen.getByAltText('組織ロゴ')).toHaveAttribute('src', uploadedUrl);

    const form = input.closest('form');
    if (!form) throw new Error('Organization settings form was not rendered');
    fireEvent.submit(form);

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(
        '/api/v1/orgs/my-org',
        expect.objectContaining({ logoUrl: uploadedUrl })
      )
    );
  });

  it('does not resubmit an oversized legacy data URL when saving other settings', async () => {
    const legacyLogoUrl = `data:image/png;base64,${'A'.repeat(2_100)}`;
    vi.mocked(get).mockResolvedValue({
      ...organization,
      logoUrl: legacyLogoUrl,
    });
    renderPage();
    expect(await screen.findByAltText('組織ロゴ')).toHaveAttribute('src', legacyLogoUrl);

    const input = screen.getByLabelText('組織ロゴ');
    const form = input.closest('form');
    if (!form) throw new Error('Organization settings form was not rendered');
    fireEvent.submit(form);

    await waitFor(() => expect(patch).toHaveBeenCalled());
    expect(vi.mocked(patch).mock.calls[0]?.[1]).not.toHaveProperty('logoUrl');
  });
});

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ManagerSettingsPage />
    </QueryClientProvider>
  );
}
