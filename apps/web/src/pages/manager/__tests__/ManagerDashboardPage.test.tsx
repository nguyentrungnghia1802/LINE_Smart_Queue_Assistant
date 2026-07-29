import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RevenueBarChart } from '../ManagerDashboardPage';

describe('RevenueBarChart', () => {
  it('renders stable proportional bars for owner and branch revenue series', () => {
    render(
      <RevenueBarChart
        points={[
          { label: '07-01', value: 0 },
          { label: '07-02', value: 500 },
          { label: '07-03', value: 1_000 },
        ]}
        formatMoney={(value) => `JPY ${value}`}
      />
    );

    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(screen.getByLabelText('07-01: JPY 0')).toHaveStyle({ height: '2%' });
    expect(screen.getByLabelText('07-02: JPY 500')).toHaveStyle({ height: '50%' });
    expect(screen.getByLabelText('07-03: JPY 1000')).toHaveStyle({ height: '100%' });
  });

  it('normalizes invalid and negative revenue values', () => {
    render(
      <RevenueBarChart
        points={[
          { label: 'negative', value: -1 },
          { label: 'invalid', value: Number.NaN },
        ]}
        formatMoney={String}
      />
    );

    expect(screen.getByLabelText('negative: 0')).toHaveStyle({ height: '2%' });
    expect(screen.getByLabelText('invalid: 0')).toHaveStyle({ height: '2%' });
  });
});
