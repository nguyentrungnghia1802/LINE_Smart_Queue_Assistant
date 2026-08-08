import { withSpan } from '../tracing';

describe('withSpan', () => {
  it('preserves business results when no exporter is configured', async () => {
    await expect(withSpan('test.operation', async () => 'ok')).resolves.toBe('ok');
  });

  it('preserves operation failures instead of replacing them with telemetry errors', async () => {
    const failure = new Error('business failure');
    await expect(
      withSpan('test.operation', async () => {
        throw failure;
      })
    ).rejects.toBe(failure);
  });
});
