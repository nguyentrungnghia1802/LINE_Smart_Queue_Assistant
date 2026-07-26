import type { IEmailAdapter } from './email.types';

export type { EmailMessage, IEmailAdapter } from './email.types';

export class DisabledEmailAdapter implements IEmailAdapter {
  async send(): Promise<void> {
    throw new Error('Email transport is disabled');
  }
}
