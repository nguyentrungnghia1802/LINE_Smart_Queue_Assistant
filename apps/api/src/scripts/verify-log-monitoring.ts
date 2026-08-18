import { config } from '../config';
import {
  LogMonitoringClient,
  type LogSubmissionResult,
} from '../modules/log-monitoring/log-monitoring.client';

async function main(): Promise<void> {
  if (!config.logMonitoring.enabled) {
    throw new Error(
      'Set LOG_MONITORING_ENABLED=true with a staging project key before running this check.'
    );
  }

  const results: LogSubmissionResult[] = [];
  const client = new LogMonitoringClient({
    ...config.logMonitoring,
    resultListener: (result) => results.push(result),
  });

  try {
    const queued = client.submit({
      level: 'INFO',
      eventType: 'SCHEDULER_JOB_FAILED',
      message: 'LINE Smart Queue Log Monitoring staging smoke test',
      context: { verification: 'staging-smoke', source: 'line-smart-queue' },
      tags: { smokeTest: true },
    });
    if (queued.outcome !== 'QUEUED_LOCALLY') {
      throw new Error(`Local monitoring queue rejected the smoke event: ${queued.outcome}`);
    }

    if (!(await client.flush())) throw new Error('Monitoring smoke-test flush timed out.');
    const finalResult = results.find(
      (result) => result.eventId === queued.eventId && result.outcome !== 'QUEUED_LOCALLY'
    );
    if (!finalResult || finalResult.outcome !== 'ACCEPTED_BY_SERVER_ADMISSION') {
      throw new Error(
        `Monitoring server did not admit the smoke event: ${finalResult?.outcome ?? 'missing-result'}`
      );
    }

    process.stdout.write(
      `Log Monitoring staging smoke accepted: eventId=${finalResult.eventId} httpStatus=${finalResult.httpStatus}` +
        (finalResult.serverRequestId ? ` serverRequestId=${finalResult.serverRequestId}` : '') +
        '\n'
    );
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Log Monitoring smoke test failed.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
