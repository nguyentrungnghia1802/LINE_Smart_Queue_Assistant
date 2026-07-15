import { config } from '../config';

interface LineBotInfo {
  displayName: string;
  basicId: string;
}

async function main(): Promise<void> {
  const token = config.line.channelAccessToken.trim();

  if (!token) {
    throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not configured.');
  }

  const headers = { Authorization: `Bearer ${token}` };
  const infoResponse = await fetch('https://api.line.me/v2/bot/info', { headers });

  if (!infoResponse.ok) {
    throw new Error(`LINE token verification failed with HTTP ${infoResponse.status}.`);
  }

  const bot = (await infoResponse.json()) as LineBotInfo;
  process.stdout.write(`LINE Messaging API connected: ${bot.displayName} (${bot.basicId})\n`);

  const sendToIndex = process.argv.indexOf('--send-to');
  const recipient = sendToIndex >= 0 ? process.argv[sendToIndex + 1]?.trim() : undefined;

  if (sendToIndex >= 0 && !recipient) {
    throw new Error('Provide a LINE user ID after --send-to.');
  }

  if (!recipient) return;

  const pushResponse = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: recipient,
      messages: [
        {
          type: 'text',
          text: 'Smart Queueの通知テストです。LINEメッセージ連携は正常に動作しています。',
        },
      ],
      notificationDisabled: false,
    }),
  });

  if (!pushResponse.ok) {
    throw new Error(`LINE test message failed with HTTP ${pushResponse.status}.`);
  }

  process.stdout.write('LINE test message accepted by the Messaging API.\n');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'LINE verification failed.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
