import type { SupportedLocale } from '@line-queue/shared';

import type { QueueEntryRow } from '../../db/repositories/queue-entries.repository';
import { normalizeLocale } from '../../i18n/locale';
import type { LineFlexMessage } from '../line/line.adapter';

import { enLineNotificationCopy } from './templates/en';
import { jaLineNotificationCopy } from './templates/ja';
import type { LineNotificationCopy, TicketNotificationEventType } from './templates/types';
import { viLineNotificationCopy } from './templates/vi';

export type { TicketNotificationEventType } from './templates/types';

interface TicketLinkOptions {
  ticketUrl?: string;
  locale?: SupportedLocale;
}

export interface TicketNotificationInput {
  eventType: TicketNotificationEventType;
  ticketCode: string;
  ticketUrl: string;
  aheadCount?: number | null;
  estimatedWaitSeconds?: number | null;
  locale?: SupportedLocale;
}

export interface TicketNotificationTemplate {
  textMessage: string;
  flexMessage: LineFlexMessage;
}

const COPY_BY_LOCALE: Record<SupportedLocale, LineNotificationCopy> = {
  ja: jaLineNotificationCopy,
  vi: viLineNotificationCopy,
  en: enLineNotificationCopy,
};

export function getLineNotificationCopy(locale?: string | null): LineNotificationCopy {
  return COPY_BY_LOCALE[normalizeLocale(locale) ?? 'ja'];
}

export function buildTicketDeepLink(
  entryId: string,
  options: { liffId?: string; webOrigin?: string }
): string {
  const state = `/liff/tickets/${entryId}`;
  if (options.liffId) {
    return `https://liff.line.me/${options.liffId}?liff.state=${encodeURIComponent(state)}`;
  }
  const origin = (options.webOrigin ?? 'http://localhost:5173').replace(/\/$/, '');
  return `${origin}${state}`;
}

function withTicketLink(message: string, copy: LineNotificationCopy, ticketUrl?: string): string {
  return ticketUrl ? `${message}\n\n${copy.labels.ticketLink}: ${ticketUrl}` : message;
}

function formatAheadCount(value: number | null | undefined, copy: LineNotificationCopy): string {
  if (value === null || value === undefined) return copy.values.checking;
  if (value <= 0) return copy.values.none;
  return copy.values.people(value);
}

function formatEstimatedWait(value: number | null | undefined, copy: LineNotificationCopy): string {
  if (value === null || value === undefined) return copy.values.checking;
  if (value <= 0) return copy.values.soon;
  const minutes = Math.ceil(value / 60);
  if (minutes < 60) return copy.values.minutes(minutes);
  return copy.values.hours(Math.floor(minutes / 60), minutes % 60);
}

function ticketNotificationText(
  input: TicketNotificationInput,
  copy: LineNotificationCopy
): string {
  const event = copy.events[input.eventType];
  return (
    `${copy.systemName}\n${event.headline}\n\n` +
    `${copy.labels.ticket}: ${input.ticketCode}\n` +
    `${copy.labels.status}: ${event.status}\n` +
    `${copy.labels.ahead}: ${formatAheadCount(input.aheadCount, copy)}\n` +
    `${copy.labels.eta}: ${formatEstimatedWait(input.estimatedWaitSeconds, copy)}\n\n` +
    `${event.guidance}\n\n${copy.labels.ticketLink}: ${input.ticketUrl}`
  );
}

export function buildTicketNotification(
  input: TicketNotificationInput
): TicketNotificationTemplate {
  const copy = getLineNotificationCopy(input.locale);
  const event = copy.events[input.eventType];
  const aheadLabel = formatAheadCount(input.aheadCount, copy);
  const etaLabel = formatEstimatedWait(input.estimatedWaitSeconds, copy);

  const flexMessage: LineFlexMessage = {
    type: 'flex',
    altText: `${copy.systemName}: ${copy.labels.ticket} ${input.ticketCode} - ${event.status}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: event.accentColor,
        paddingAll: '16px',
        contents: [
          { type: 'text', text: copy.systemName, color: '#FFFFFF', size: 'xs', weight: 'bold' },
          {
            type: 'text',
            text: event.headline,
            color: '#FFFFFF',
            size: 'lg',
            weight: 'bold',
            margin: 'md',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          { type: 'text', text: copy.labels.ticket, color: '#6B7280', size: 'xs', weight: 'bold' },
          { type: 'text', text: input.ticketCode, color: '#111827', size: '4xl', weight: 'bold' },
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'sm',
            margin: 'lg',
            contents: [
              buildFieldRow(copy.labels.status, event.status),
              buildFieldRow(copy.labels.ahead, aheadLabel),
              buildFieldRow(copy.labels.eta, etaLabel),
            ],
          },
          {
            type: 'text',
            text: event.guidance,
            color: '#374151',
            size: 'sm',
            wrap: true,
            margin: 'lg',
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#06C755',
            action: { type: 'uri', label: copy.labels.openTicket, uri: input.ticketUrl },
          },
        ],
      },
    },
  };

  return { textMessage: ticketNotificationText(input, copy), flexMessage };
}

function buildFieldRow(label: string, value: string): Record<string, unknown> {
  return {
    type: 'box',
    layout: 'horizontal',
    contents: [
      { type: 'text', text: label, color: '#6B7280', size: 'sm', flex: 3 },
      {
        type: 'text',
        text: value,
        color: '#111827',
        size: 'sm',
        weight: 'bold',
        align: 'end',
        flex: 4,
        wrap: true,
      },
    ],
  };
}

export function ticketBookingCreatedMessage(
  ticketCode: string,
  options: TicketLinkOptions & {
    aheadCount?: number | null;
    estimatedWaitSeconds?: number | null;
  } = {}
): string {
  return buildTicketNotification({
    eventType: 'booking_created',
    ticketCode,
    ticketUrl: options.ticketUrl ?? '',
    aheadCount: options.aheadCount,
    estimatedWaitSeconds: options.estimatedWaitSeconds,
    locale: options.locale,
  }).textMessage;
}

export function ticketCalledMessage(ticketCode: string, options: TicketLinkOptions = {}): string {
  const copy = getLineNotificationCopy(options.locale);
  return withTicketLink(
    `${copy.events.called.headline}: ${copy.labels.ticket} ${ticketCode}. ${copy.events.called.guidance}`,
    copy,
    options.ticketUrl
  );
}

export function etaWarningMessage(
  ticketCode: string,
  aheadCount: number,
  options: TicketLinkOptions = {}
): string {
  const copy = getLineNotificationCopy(options.locale);
  return withTicketLink(
    `${copy.events.eta_warning.headline}: ${copy.labels.ticket} ${ticketCode}. ${copy.labels.ahead}: ${copy.values.people(aheadCount)}. ${copy.events.eta_warning.guidance}`,
    copy,
    options.ticketUrl
  );
}

export function ticketServingMessage(ticketCode: string, options: TicketLinkOptions = {}): string {
  const copy = getLineNotificationCopy(options.locale);
  return withTicketLink(
    `${copy.events.serving.headline}: ${copy.labels.ticket} ${ticketCode}.`,
    copy,
    options.ticketUrl
  );
}

export function ticketCompletedMessage(
  ticketCode: string,
  options: TicketLinkOptions = {}
): string {
  const copy = getLineNotificationCopy(options.locale);
  if (copy.locale === 'ja') {
    return withTicketLink(
      `受付番号 ${ticketCode} の対応が完了しました。ご利用ありがとうございました。`,
      copy,
      options.ticketUrl
    );
  }
  return withTicketLink(
    `${copy.events.completed.headline}: ${copy.labels.ticket} ${ticketCode}. ${copy.events.completed.guidance}`,
    copy,
    options.ticketUrl
  );
}

export function ticketCancelledMessage(
  ticketCode: string,
  options: TicketLinkOptions = {}
): string {
  const copy = getLineNotificationCopy(options.locale);
  return withTicketLink(
    `${copy.events.cancelled.headline}: ${copy.labels.ticket} ${ticketCode}.`,
    copy,
    options.ticketUrl
  );
}

export function cancelSucceededMessage(locale?: SupportedLocale): string {
  return getLineNotificationCopy(locale).commands.cancelSucceeded;
}
export function ticketNoShowMessage(ticketCode: string, options: TicketLinkOptions = {}): string {
  const copy = getLineNotificationCopy(options.locale);
  return withTicketLink(
    `${copy.events.no_show.headline}: ${copy.labels.ticket} ${ticketCode}.`,
    copy,
    options.ticketUrl
  );
}
export function followWelcomeMessage(locale?: SupportedLocale): string {
  return getLineNotificationCopy(locale).commands.welcome;
}
export function helpMessage(locale?: SupportedLocale): string {
  return getLineNotificationCopy(locale).commands.help;
}
export function noActiveTicketMessage(locale?: SupportedLocale): string {
  return getLineNotificationCopy(locale).commands.noActive;
}
export function activeTicketStatusMessage(
  entries: QueueEntryRow[],
  locale?: SupportedLocale
): string {
  const copy = getLineNotificationCopy(locale);
  const lines = entries
    .map(
      (entry) =>
        `• ${copy.labels.ticket} ${entry.ticket_code} - ${formatEntryStatus(entry.status, locale)}`
    )
    .join('\n');
  return `${copy.commands.activeHeader}\n${lines}`;
}
export function noCancellableTicketMessage(locale?: SupportedLocale): string {
  return getLineNotificationCopy(locale).commands.noCancellable;
}
export function cancelFailedMessage(locale?: SupportedLocale): string {
  return getLineNotificationCopy(locale).commands.cancelFailed;
}
export function skipSucceededMessage(ticketCode: string, locale?: SupportedLocale): string {
  return getLineNotificationCopy(locale).commands.skipSucceeded(ticketCode);
}
export function skipFailedMessage(locale?: SupportedLocale): string {
  return getLineNotificationCopy(locale).commands.skipFailed;
}
export function unknownCommandMessage(locale?: SupportedLocale): string {
  return getLineNotificationCopy(locale).commands.unknown;
}
export function formatEntryStatus(status: string, locale?: SupportedLocale): string {
  return getLineNotificationCopy(locale).statuses[status] ?? status;
}
