import { UpdateOwnerEmailSchema } from '../admin.validator';

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
