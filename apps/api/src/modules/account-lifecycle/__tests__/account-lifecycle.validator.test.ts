import { CompleteAccountActionSchema, ForgotPasswordSchema } from '../account-lifecycle.validator';

describe('account lifecycle validation', () => {
  it('requires a strong matching password and a sufficiently long token', () => {
    const token = 'a'.repeat(32);
    expect(
      CompleteAccountActionSchema.parse({
        token,
        password: 'secure-pass-123',
        passwordConfirmation: 'secure-pass-123',
      })
    ).toMatchObject({ token });
    expect(() =>
      CompleteAccountActionSchema.parse({
        token,
        password: 'secure-pass-123',
        passwordConfirmation: 'different-123',
      })
    ).toThrow();
  });

  it('normalizes a forgot-password email without exposing account state', () => {
    expect(ForgotPasswordSchema.parse({ email: ' Owner@Example.JP ' })).toEqual({
      email: 'owner@example.jp',
    });
  });
});
