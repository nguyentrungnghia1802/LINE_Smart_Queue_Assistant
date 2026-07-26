import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { config } from '../../config';
import { logger } from '../../utils/logger';

import type { EmailMessage, IEmailAdapter } from './email.types';

export class MockEmailAdapter implements IEmailAdapter {
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
    await mkdir(config.email.mockOutputDir, { recursive: true });
    const outputPath = path.join(config.email.mockOutputDir, `${message.id}.html`);
    await writeFile(outputPath, message.html, { encoding: 'utf8', mode: 0o600 });
    logger.info({ emailId: message.id, outputPath }, 'email.mock.preview-created');
  }
}
