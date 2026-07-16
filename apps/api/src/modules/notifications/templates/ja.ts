import type { LineNotificationCopy } from './types';

export const jaLineNotificationCopy: LineNotificationCopy = {
  locale: 'ja',
  systemName: 'LINE Smart Queue Assistant',
  labels: {
    ticket: '受付番号',
    status: '状態',
    ahead: '前の人数',
    eta: '待ち時間目安',
    openTicket: '受付状況を開く',
    ticketLink: '受付状況',
  },
  values: {
    checking: '確認中',
    none: 'なし',
    soon: 'まもなく',
    people: (count) => `${count}名`,
    minutes: (count) => `約${count}分`,
    hours: (hours, minutes) => (minutes === 0 ? `約${hours}時間` : `約${hours}時間${minutes}分`),
  },
  events: {
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
  },
  statuses: {
    waiting: '待機中',
    called: '呼び出し中',
    serving: '対応中',
    served: '完了',
    completed: '完了',
    cancelled: 'キャンセル済み',
    skipped: 'スキップ済み',
    no_show: '不在',
  },
  commands: {
    welcome:
      'LINE Smart Queue Assistantへようこそ。\n\n店頭のQRコードを読み取ると受付番号を取得できます。\n"STATUS"で現在の受付状況、"HELP"で使い方を確認できます。',
    help: '利用できるコマンド:\nSTATUS - 現在の受付番号を確認\nCANCEL - 現在の受付をキャンセル\nHELP - この案内を表示',
    noActive:
      '現在有効な受付番号はありません。\n店頭のQRコードを読み取って順番待ちに参加してください。',
    activeHeader: '現在の受付番号:',
    noCancellable: 'キャンセルできる有効な受付番号はありません。',
    cancelSucceeded: '受付番号をキャンセルしました。',
    cancelFailed: 'キャンセルできませんでした。すでに処理済みの可能性があります。',
    skipSucceeded: (ticketCode) => `受付番号 ${ticketCode} を1つ後ろに移動しました。`,
    skipFailed: '順番を後ろへ移動できませんでした。もう一度お試しください。',
    unknown: '"HELP"と入力すると使い方を確認できます。',
  },
};
