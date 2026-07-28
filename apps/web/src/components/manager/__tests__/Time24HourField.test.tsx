import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { Time24HourField } from '../Time24HourField';

function TimeHarness() {
  const [value, setValue] = useState('09:30');
  return (
    <>
      <Time24HourField
        label="Monday opening time"
        hourLabel="Hour"
        minuteLabel="Minute"
        value={value}
        onChange={setValue}
      />
      <output data-testid="selected-time">{value}</output>
    </>
  );
}

describe('Time24HourField', () => {
  it('supports every minute through 23:59 without locale AM/PM rendering', async () => {
    const user = userEvent.setup();
    render(<TimeHarness />);

    await user.selectOptions(screen.getByLabelText('Monday opening time - Hour'), '23');
    await user.selectOptions(screen.getByLabelText('Monday opening time - Minute'), '59');

    expect(screen.getByTestId('selected-time')).toHaveTextContent('23:59');
    expect(screen.queryByText(/AM|PM/)).not.toBeInTheDocument();
  });
});
