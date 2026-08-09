import { NUMERIC_LIMITS } from '@line-queue/shared';

import { CreateOrganizationApplicationSchema } from './organization-applications.validator';

const validApplication = {
  legalName: 'Tokyo Service Company',
  tradeName: 'Smart Reception Tokyo',
  businessType: 'salon',
  workEmail: 'owner@example.jp',
  contactName: 'Yuki Tanaka',
  phone: '0312345678',
  postalCode: '100-0001',
  prefecture: 'Tokyo',
  city: 'Chiyoda',
  addressLine1: '1-1 Chiyoda',
  expectedMonthlyCustomers: 1000,
  billingCycle: 'monthly',
  defaultLocale: 'ja',
  termsAccepted: true,
} as const;

describe('organization application plan limits', () => {
  it.each([
    ['starter', 1],
    ['standard', 3],
    ['scale', 100],
  ] as const)('accepts %s with %d requested branches', (planCode, locationCount) => {
    expect(
      CreateOrganizationApplicationSchema.safeParse({
        ...validApplication,
        planCode,
        locationCount,
      }).success
    ).toBe(true);
  });

  it.each([
    ['starter', 2],
    ['standard', 4],
  ] as const)('rejects %s above its branch allowance', (planCode, locationCount) => {
    const result = CreateOrganizationApplicationSchema.safeParse({
      ...validApplication,
      planCode,
      locationCount,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(['locationCount']);
  });

  it('rejects unrealistic location and expected-customer counts', () => {
    expect(
      CreateOrganizationApplicationSchema.safeParse({
        ...validApplication,
        planCode: 'scale',
        locationCount: NUMERIC_LIMITS.organizationLocationCount.max + 1,
      }).success
    ).toBe(false);
    expect(
      CreateOrganizationApplicationSchema.safeParse({
        ...validApplication,
        planCode: 'scale',
        locationCount: 10,
        expectedMonthlyCustomers: NUMERIC_LIMITS.expectedMonthlyCustomers.max + 1,
      }).success
    ).toBe(false);
  });
});
