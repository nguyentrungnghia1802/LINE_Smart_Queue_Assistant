import { UpdateOrgSettingsSchema } from '../orgs.validator';

describe('UpdateOrgSettingsSchema logo URL', () => {
  it.each([
    '/media/organization_logo/2026-08-02/logo.webp',
    '/mock-media/organization_logo/2026-08-02/logo.webp',
    'https://cdn.example.com/organization/logo.webp',
  ])('accepts a persisted image URL: %s', (logoUrl) => {
    expect(UpdateOrgSettingsSchema.safeParse({ logoUrl }).success).toBe(true);
  });

  it.each([
    '/images/logo.png',
    'data:image/png;base64,AAAA',
    'javascript:alert(1)',
    `https://example.com/${'a'.repeat(2_000)}`,
  ])('rejects an unsafe or non-persistable image URL', (logoUrl) => {
    expect(UpdateOrgSettingsSchema.safeParse({ logoUrl }).success).toBe(false);
  });
});
