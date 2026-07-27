import type { SupportedLocale } from '@line-queue/shared';

export type EmailTemplateKey =
  | 'account_activation'
  | 'password_reset'
  | 'organization_application_submitted'
  | 'organization_application_rejected';
export type EmailDeliveryStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';

export interface EmailMessage {
  id: string;
  to: string;
  fromName: string;
  fromAddress: string;
  subject: string;
  text: string;
  html: string;
}

export interface IEmailAdapter {
  send(message: EmailMessage): Promise<void>;
}

export interface EmailTemplateInput {
  templateKey: EmailTemplateKey;
  locale: SupportedLocale;
  actionUrl?: string;
  displayName: string;
  organizationName?: string;
  expiresIn?: string;
  referenceCode?: string;
  planName?: string;
  locationCount?: string;
  amountYen?: string;
  reviewNote?: string;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}
