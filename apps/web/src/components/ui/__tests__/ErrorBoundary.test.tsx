import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { i18n } from '../../../i18n';

const { captureFrontendException } = vi.hoisted(() => ({ captureFrontendException: vi.fn() }));

vi.mock('../../../observability/sentry', () => ({ captureFrontendException }));

import { ErrorBoundary } from '../ErrorBoundary';

function BrokenView(): never {
  throw new Error('render failed');
}

function preventExpectedWindowError(event: ErrorEvent): void {
  if (event.error instanceof Error && event.error.message === 'render failed') {
    event.preventDefault();
  }
}

describe('ErrorBoundary observability', () => {
  beforeEach(() => {
    captureFrontendException.mockClear();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    window.addEventListener('error', preventExpectedWindowError);
  });

  afterEach(() => {
    window.removeEventListener('error', preventExpectedWindowError);
    vi.restoreAllMocks();
  });

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
