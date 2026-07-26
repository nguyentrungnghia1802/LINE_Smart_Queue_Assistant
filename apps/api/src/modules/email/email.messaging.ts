import { config } from '../../config';

import { DisabledEmailAdapter } from './email.adapter';
import { MockEmailAdapter } from './email.mock.adapter';
import { SmtpEmailAdapter } from './email.smtp.adapter';
import type { IEmailAdapter } from './email.types';

function createEmailAdapter(): IEmailAdapter {
  if (config.email?.mode === 'smtp') return new SmtpEmailAdapter();
  if (config.email?.mode === 'mock') return new MockEmailAdapter();
  return new DisabledEmailAdapter();
}

export const emailAdapter = createEmailAdapter();
