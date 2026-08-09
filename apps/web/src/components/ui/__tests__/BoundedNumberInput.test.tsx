import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { normalizeBoundedNumberInput } from '../../../utils/numericInput';
import { BoundedNumberInput } from '../BoundedNumberInput';

describe('BoundedNumberInput', () => {
  it('accepts an in-range integer and rejects letters, decimals, negatives, and oversized values', () => {
    expect(normalizeBoundedNumberInput('42', { min: 0, max: 100, integer: true })).toBe('42');
    expect(normalizeBoundedNumberInput('4e2', { min: 0, max: 100, integer: true })).toBeNull();
    expect(normalizeBoundedNumberInput('1.5', { min: 0, max: 100, integer: true })).toBeNull();
    expect(normalizeBoundedNumberInput('-1', { min: 0, max: 100, integer: true })).toBeNull();
    expect(normalizeBoundedNumberInput('101', { min: 0, max: 100, integer: true })).toBeNull();
  });

  it('allows bounded negative decimal coordinates', () => {
    expect(normalizeBoundedNumberInput('-35.681236', { min: -90, max: 90, integer: false })).toBe(
      '-35.681236'
    );
    expect(normalizeBoundedNumberInput('-91', { min: -90, max: 90, integer: false })).toBeNull();
  });

  it('keeps an oversized value available to the form validation manager for correction', () => {
    const onValueChange = vi.fn();
    render(
      <BoundedNumberInput
        aria-label="capacity"
        min={1}
        max={100}
        value="10"
        onValueChange={onValueChange}
      />
    );

    fireEvent.change(screen.getByLabelText('capacity'), { target: { value: '101' } });
    expect(onValueChange).toHaveBeenCalledWith('101');
  });
});
