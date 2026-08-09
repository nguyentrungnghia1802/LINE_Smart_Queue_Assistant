import { CreateBranchSchema, UpdateOwnedBranchSchema } from '../branches.validator';

const validBranch = {
  name: 'Tokyo Station',
  phone: '0312345678',
  email: 'tokyo@example.jp',
  postalCode: '100-0001',
  prefecture: 'Tokyo',
  city: 'Chiyoda',
  addressLine1: '1-1 Marunouchi',
};

describe('branch validators', () => {
  it('accepts a partial owner branch update', () => {
    expect(UpdateOwnedBranchSchema.safeParse({ name: 'Shinjuku Branch' }).success).toBe(true);
  });

  it('rejects an empty owner branch update', () => {
    expect(UpdateOwnedBranchSchema.safeParse({}).success).toBe(false);
  });

  it('requires coordinates to be supplied together and within range', () => {
    expect(UpdateOwnedBranchSchema.safeParse({ latitude: 35.68 }).success).toBe(false);
    expect(UpdateOwnedBranchSchema.safeParse({ latitude: 91, longitude: 139.76 }).success).toBe(
      false
    );
    expect(UpdateOwnedBranchSchema.safeParse({ latitude: 35.68, longitude: 139.76 }).success).toBe(
      true
    );
  });

  it('keeps branch creation bounded and requires at least one manager invitation', () => {
    expect(CreateBranchSchema.safeParse({ ...validBranch, managers: [] }).success).toBe(false);
    expect(
      CreateBranchSchema.safeParse({
        ...validBranch,
        name: 'x'.repeat(161),
        managers: [
          {
            displayName: 'Yuki Tanaka',
            email: 'manager@example.jp',
            phone: '09012345678',
          },
        ],
      }).success
    ).toBe(false);
  });
});
