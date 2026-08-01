import { describe, expect, it } from 'vitest';

import { firstFieldError, getApiFieldErrors } from '../formValidation';

describe('formValidation', () => {
  it('extracts exact API field errors including nested paths', () => {
    const errors = getApiFieldErrors({
      details: {
        fieldErrors: {
          'managers.0.email': ['Email is already registered'],
        },
      },
    });

    expect(firstFieldError(errors, 'managers.0.email', 'email')).toBe(
      'Email is already registered'
    );
  });

  it('falls back to the next requested field path', () => {
    const errors = { email: ['Invalid email address'] };

    expect(firstFieldError(errors, 'managers.0.email', 'email')).toBe('Invalid email address');
  });

  it('returns an empty map for non-validation errors', () => {
    expect(getApiFieldErrors(new Error('Network error'))).toEqual({});
  });
});
