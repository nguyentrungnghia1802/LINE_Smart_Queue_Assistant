import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { i18n } from '../../../i18n';
import { FormValidationManager } from '../FormValidationManager';

describe('FormValidationManager', () => {
  it('shows one localized error below an invalid field and clears it after correction', async () => {
    await i18n.changeLanguage('en');
    render(
      <>
        <FormValidationManager />
        <form>
          <label>
            Email
            <input name="email" type="email" required />
          </label>
        </form>
      </>
    );

    const input = screen.getByRole('textbox', { name: 'Email' });
    fireEvent.blur(input);
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent('This field is required.');
    expect(input).toHaveAttribute('aria-invalid', 'true');

    fireEvent.input(input, { target: { value: 'person@example.jp' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('uses the first applicable constraint instead of stacking messages', async () => {
    await i18n.changeLanguage('en');
    render(
      <>
        <FormValidationManager />
        <label>
          Code
          <input name="code" required pattern="[A-Z]{3}" />
        </label>
      </>
    );

    const input = screen.getByRole('textbox', { name: 'Code' });
    fireEvent.change(input, { target: { value: 'x' } });
    fireEvent.blur(input);

    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent('Enter the value in the required format.');
  });

  it('shows a single range error while a numeric value is being entered', async () => {
    await i18n.changeLanguage('en');
    render(
      <>
        <FormValidationManager />
        <label>
          Capacity
          <input name="capacity" type="number" min={1} max={100} />
        </label>
      </>
    );

    const input = screen.getByRole('spinbutton', { name: 'Capacity' });
    fireEvent.input(input, { target: { value: '101' } });

    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a value less than or equal to 100.');
  });

  it('does not remove an API-owned aria-invalid marker from a natively valid field', async () => {
    await i18n.changeLanguage('en');
    render(
      <>
        <FormValidationManager />
        <label>
          Name
          <input name="name" aria-invalid="true" value="Valid" readOnly />
        </label>
      </>
    );

    const input = screen.getByRole('textbox', { name: 'Name' });
    fireEvent.blur(input);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
