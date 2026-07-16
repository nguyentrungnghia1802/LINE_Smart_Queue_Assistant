import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LanguageSwitcher } from '../LanguageSwitcher';

describe('LanguageSwitcher', () => {
  it('changes language and persists the anonymous choice', async () => {
    render(<LanguageSwitcher />);

    fireEvent.change(screen.getByRole('combobox', { name: '言語' }), {
      target: { value: 'vi' },
    });

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Ngôn ngữ' })).toHaveValue('vi');
    });
    expect(localStorage.getItem('line-queue-locale')).toBe('vi');
  });
});
