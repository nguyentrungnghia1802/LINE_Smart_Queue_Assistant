import type { QueueEntryRow } from '../../db/repositories/queue-entries.repository';
import type { LineFlexMessage } from '../line/line.adapter';

interface TicketLinkOptions {
  ticketUrl?: string;
}

export type TicketNotificationEventType =
  | 'booking_created'
  | 'eta_warning'
  | 'called'
  | 'serving'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'location_warning';

export interface TicketNotificationInput {
  eventType: TicketNotificationEventType;
  ticketCode: string;
  ticketUrl: string;
  aheadCount?: number | null;
  estimatedWaitSeconds?: number | null;
}

export interface TicketNotificationTemplate {
  textMessage: string;
  flexMessage: LineFlexMessage;
}

const SYSTEM_NAME = 'LINE Smart Queue Assistant';

const EVENT_COPY: Record<
  TicketNotificationEventType,
  {
    headline: string;
    status: string;
    guidance: string;
    accentColor: string;
  }
> = {
  booking_created: {
    headline: '受付が完了しました',
    status: '受付完了',
    guidance: '順番が近づくまで、受付状況を確認しながらお待ちください。',
    accentColor: '#06C755',
  },
  eta_warning: {
    headline: 'まもなく順番です',
    status: '順番が近づいています',
    guidance: 'カウンター付近でお待ちください。',
    accentColor: '#F59E0B',
  },
  called: {
    headline: '順番になりました',
    status: '呼び出し中',
    guidance: 'カウンターまでお越しください。',
    accentColor: '#06C755',
  },
  serving: {
    headline: '対応を開始しました',
    status: '対応中',
    guidance: 'スタッフの案内に沿ってお進みください。',
    accentColor: '#2563EB',
  },
  completed: {
    headline: '対応が完了しました',
    status: '完了',
    guidance: 'ご利用ありがとうございました。',
    accentColor: '#4B5563',
  },
  cancelled: {
    headline: '受付をキャンセルしました',
    status: 'キャンセル済み',
    guidance: '必要な場合は、もう一度受付を行ってください。',
    accentColor: '#DC2626',
  },
  no_show: {
    headline: '不在として処理されました',
    status: '不在',
    guidance: 'お手数ですが、必要な場合はスタッフへお声がけください。',
    accentColor: '#EA580C',
  },
  location_warning: {
    headline: '店舗までの距離をご確認ください',
    status: '移動のご案内',
    guidance: '順番が近づいています。余裕をもって店舗へお戻りください。',
    accentColor: '#0F766E',
  },
};

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

function withTicketLink(message: string, ticketUrl?: string): string {
  if (!ticketUrl) return message;
  return `${message}\n\n受付状況: ${ticketUrl}`;
}

function formatAheadCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return '確認中';
  if (value <= 0) return 'なし';
  return `${value}名`;
}

function formatEstimatedWait(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '確認中';
  if (seconds <= 0) return 'まもなく';
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `約${minutes}分`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `約${hours}時間` : `約${hours}時間${rest}分`;
}

function ticketNotificationText(input: TicketNotificationInput): string {
  const copy = EVENT_COPY[input.eventType];
  return (
    `${SYSTEM_NAME}\n` +
    `${copy.headline}\n\n` +
    `受付番号: ${input.ticketCode}\n` +
    `状態: ${copy.status}\n` +
    `前の人数: ${formatAheadCount(input.aheadCount)}\n` +
    `待ち時間目安: ${formatEstimatedWait(input.estimatedWaitSeconds)}\n\n` +
    `${copy.guidance}\n\n` +
    `受付状況: ${input.ticketUrl}`
  );
}

export function buildTicketNotification(
  input: TicketNotificationInput
): TicketNotificationTemplate {
  const copy = EVENT_COPY[input.eventType];
  const aheadLabel = formatAheadCount(input.aheadCount);
  const etaLabel = formatEstimatedWait(input.estimatedWaitSeconds);
  const textMessage = ticketNotificationText(input);

  const flexMessage: LineFlexMessage = {
    type: 'flex',
    altText: `${SYSTEM_NAME}: 受付番号 ${input.ticketCode} - ${copy.status}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: copy.accentColor,
        paddingAll: '16px',
        contents: [
          {
            type: 'text',
            text: SYSTEM_NAME,
            color: '#FFFFFF',
            size: 'xs',
            weight: 'bold',
          },
          {
            type: 'text',
            text: copy.headline,
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
          {
            type: 'text',
            text: '受付番号',
            color: '#6B7280',
            size: 'xs',
            weight: 'bold',
          },
          {
            type: 'text',
            text: input.ticketCode,
            color: '#111827',
            size: '4xl',
            weight: 'bold',
          },
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'sm',
            margin: 'lg',
            contents: [
              buildFieldRow('状態', copy.status),
              buildFieldRow('前の人数', aheadLabel),
              buildFieldRow('待ち時間目安', etaLabel),
            ],
          },
          {
            type: 'text',
            text: copy.guidance,
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
            action: {
              type: 'uri',
              label: '受付状況を開く',
              uri: input.ticketUrl,
            },
          },
        ],
      },
    },
  };

  return { textMessage, flexMessage };
}

function buildFieldRow(label: string, value: string): Record<string, unknown> {
  return {
    type: 'box',
    layout: 'horizontal',
    contents: [
      {
        type: 'text',
        text: label,
        color: '#6B7280',
        size: 'sm',
        flex: 3,
      },
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
  }).textMessage;
}

export function ticketCalledMessage(ticketCode: string, options: TicketLinkOptions = {}): string {
  return withTicketLink(
    `受付番号 ${ticketCode} の順番です。\n\n` +
      'カウンターまでお越しください。お待ちいただきありがとうございます。',
    options.ticketUrl
  );
}

export function etaWarningMessage(
  ticketCode: string,
  aheadCount: number,
  options: TicketLinkOptions = {}
): string {
  const who = aheadCount === 1 ? '前に1名' : `前に${aheadCount}名`;
  return withTicketLink(
    `受付番号 ${ticketCode} の順番が近づいています。\n\n` +
      `${who}お待ちです。カウンター付近でお待ちください。`,
    options.ticketUrl
  );
}

export function ticketServingMessage(ticketCode: string, options: TicketLinkOptions = {}): string {
  return withTicketLink(`受付番号 ${ticketCode} の対応を開始しました。`, options.ticketUrl);
}

export function ticketCompletedMessage(
  ticketCode: string,
  options: TicketLinkOptions = {}
): string {
  return withTicketLink(
    `受付番号 ${ticketCode} の対応が完了しました。ご利用ありがとうございました。`,
    options.ticketUrl
  );
}

export function ticketCancelledMessage(
  ticketCode: string,
  options: TicketLinkOptions = {}
): string {
  return withTicketLink(`受付番号 ${ticketCode} をキャンセルしました。`, options.ticketUrl);
}

export function cancelSucceededMessage(): string {
  return '受付番号をキャンセルしました。';
}

export function ticketNoShowMessage(ticketCode: string, options: TicketLinkOptions = {}): string {
  return withTicketLink(`受付番号 ${ticketCode} は不在として処理されました。`, options.ticketUrl);
}

export function followWelcomeMessage(): string {
  return (
    'LINE Smart Queue Assistantへようこそ。\n\n' +
    '店頭のQRコードを読み取ると受付番号を取得できます。\n' +
    '"STATUS"で現在の受付状況、"HELP"で使い方を確認できます。'
  );
}

export function helpMessage(): string {
  return (
    '利用できるコマンド:\n' +
    'STATUS - 現在の受付番号を確認\n' +
    'CANCEL - 現在の受付をキャンセル\n' +
    'HELP - この案内を表示'
  );
}

export function noActiveTicketMessage(): string {
  return (
    '現在有効な受付番号はありません。\n' + '店頭のQRコードを読み取って順番待ちに参加してください。'
  );
}

export function activeTicketStatusMessage(entries: QueueEntryRow[]): string {
  const lines = entries
    .map((entry) => `・受付番号 ${entry.ticket_code} - ${formatEntryStatus(entry.status)}`)
    .join('\n');
  return `現在の受付番号:\n${lines}`;
}

export function noCancellableTicketMessage(): string {
  return 'キャンセルできる有効な受付番号はありません。';
}

export function cancelFailedMessage(): string {
  return 'キャンセルできませんでした。すでに処理済みの可能性があります。';
}

export function skipSucceededMessage(ticketCode: string): string {
  return `受付番号 ${ticketCode} を1つ後ろに移動しました。`;
}

export function skipFailedMessage(): string {
  return '順番を後ろへ移動できませんでした。もう一度お試しください。';
}

export function unknownCommandMessage(): string {
  return '"HELP"と入力すると使い方を確認できます。';
}

export function formatEntryStatus(status: string): string {
  const labels: Record<string, string> = {
    waiting: '待機中',
    called: '呼び出し中',
    serving: '対応中',
    served: '完了',
    completed: '完了',
    cancelled: 'キャンセル済み',
    skipped: 'スキップ済み',
    no_show: '不在',
  };
  return labels[status] ?? status;
}
