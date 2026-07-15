import type { QueueEntryRow } from '../../db/repositories/queue-entries.repository';

export function ticketCalledMessage(ticketCode: string): string {
  return (
    `受付番号 ${ticketCode} の順番です。\n\n` +
    'カウンターまでお越しください。お待ちいただきありがとうございます。'
  );
}

export function etaWarningMessage(ticketCode: string, aheadCount: number): string {
  const who = aheadCount === 1 ? '前に1名' : `前に${aheadCount}名`;
  return (
    `受付番号 ${ticketCode} の順番が近づいています。\n\n` +
    `${who}お待ちです。カウンター付近でお待ちください。`
  );
}

export function ticketServingMessage(ticketCode: string): string {
  return `受付番号 ${ticketCode} の対応を開始しました。`;
}

export function ticketCompletedMessage(ticketCode: string): string {
  return `受付番号 ${ticketCode} の対応が完了しました。ご利用ありがとうございました。`;
}

export function ticketCancelledMessage(ticketCode: string): string {
  return `受付番号 ${ticketCode} をキャンセルしました。`;
}

export function cancelSucceededMessage(): string {
  return '受付番号をキャンセルしました。';
}

export function ticketNoShowMessage(ticketCode: string): string {
  return `受付番号 ${ticketCode} は不在として処理されました。`;
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
