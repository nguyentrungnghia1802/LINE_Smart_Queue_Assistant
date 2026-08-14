import { ORGANIZATION_SUSPENSION_NOTE_MAX_LENGTH } from '@line-queue/shared';

import { SuspendOrganizationSchema, UpdateOwnerEmailSchema } from '../admin.validator';

describe('UpdateOwnerEmailSchema', () => {
  it('normalizes and accepts an email-only payload', () => {
    expect(UpdateOwnerEmailSchema.parse({ email: ' OWNER@Example.com ' })).toEqual({
      email: 'owner@example.com',
    });
  });

  it.each(['displayName', 'password', 'isActive'])('rejects the forbidden %s field', (field) => {
    expect(() =>
      UpdateOwnerEmailSchema.parse({
        email: 'owner@example.com',
        [field]: field === 'isActive' ? true : 'unauthorized-value',
      })
    ).toThrow();
  });

  it('rejects missing or invalid email values', () => {
    expect(() => UpdateOwnerEmailSchema.parse({})).toThrow();
    expect(() => UpdateOwnerEmailSchema.parse({ email: 'not-an-email' })).toThrow();
  });
});

describe('SuspendOrganizationSchema', () => {
  it.each(['contract_renewal_cancelled', 'organization_request', 'other'] as const)(
    'accepts the supported %s reason',
    (reason) => {
      expect(SuspendOrganizationSchema.parse({ reason, note: '  Additional context  ' })).toEqual({
        reason,
        note: 'Additional context',
      });
    }
  );

  it('normalizes an empty optional note away', () => {
    expect(SuspendOrganizationSchema.parse({ reason: 'other', note: '   ' })).toEqual({
      reason: 'other',
      note: undefined,
    });
  });

  it('rejects missing, unsupported, oversized, or extra values', () => {
    expect(() => SuspendOrganizationSchema.parse({})).toThrow();
    expect(() => SuspendOrganizationSchema.parse({ reason: 'billing_failure' })).toThrow();
    expect(() =>
      SuspendOrganizationSchema.parse({
        reason: 'other',
        note: 'x'.repeat(ORGANIZATION_SUSPENSION_NOTE_MAX_LENGTH + 1),
      })
    ).toThrow();
    expect(() =>
      SuspendOrganizationSchema.parse({ reason: 'other', deletePermanently: true })
    ).toThrow();
  });
});
