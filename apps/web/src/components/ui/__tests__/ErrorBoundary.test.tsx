import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { i18n } from '../../../i18n';

const { captureFrontendException } = vi.hoisted(() => ({ captureFrontendException: vi.fn() }));

vi.mock('../../../observability/sentry', () => ({ captureFrontendException }));

import { ErrorBoundary } from '../ErrorBoundary';

function BrokenView(): never {
  throw new Error('render failed');
}

describe('ErrorBoundary observability', () => {
  beforeEach(() => {
    captureFrontendException.mockClear();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it('captures a React render failure and preserves the localized fallback', () => {
    render(
      <ErrorBoundary>
        <BrokenView />
      </ErrorBoundary>
    );

    expect(captureFrontendException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'render failed' }),
      expect.objectContaining({ componentStack: expect.any(String) })
    );
    expect(screen.getAllByText(i18n.t('common:errors.UNKNOWN'))).toHaveLength(2);
  });
});
