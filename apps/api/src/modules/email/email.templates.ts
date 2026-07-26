import type { SupportedLocale } from '@line-queue/shared';

import type { EmailTemplateInput, RenderedEmail } from './email.types';

type Copy = {
  activationSubject: string;
  resetSubject: string;
  greeting: (name: string) => string;
  activationBody: (organizationName: string) => string;
  resetBody: string;
  activationCta: string;
  resetCta: string;
  expiry: (value: string) => string;
  ignore: string;
  fallback: string;
};

const COPY: Record<SupportedLocale, Copy> = {
  ja: {
    activationSubject: 'Smart Queue Assistant アカウントの有効化',
    resetSubject: 'Smart Queue Assistant パスワード再設定',
    greeting: (name) => `${name} 様`,
    activationBody: (organizationName) =>
      `${organizationName} の利用申請が承認されました。下のボタンからパスワードを設定し、アカウントを有効化してください。`,
    resetBody:
      'パスワード再設定のリクエストを受け付けました。下のボタンから新しいパスワードを設定してください。',
    activationCta: 'アカウントを有効化',
    resetCta: 'パスワードを再設定',
    expiry: (value) => `このリンクの有効期限は ${value} です。`,
    ignore: 'この操作に心当たりがない場合は、このメールを破棄してください。',
    fallback: 'ボタンを開けない場合は、次のURLをブラウザに貼り付けてください。',
  },
  vi: {
    activationSubject: 'Kích hoạt tài khoản Smart Queue Assistant',
    resetSubject: 'Đặt lại mật khẩu Smart Queue Assistant',
    greeting: (name) => `Xin chào ${name},`,
    activationBody: (organizationName) =>
      `Hồ sơ đăng ký của ${organizationName} đã được chấp thuận. Hãy đặt mật khẩu để kích hoạt tài khoản bằng nút bên dưới.`,
    resetBody:
      'Hệ thống đã nhận được yêu cầu đặt lại mật khẩu. Hãy tạo mật khẩu mới bằng nút bên dưới.',
    activationCta: 'Kích hoạt tài khoản',
    resetCta: 'Đặt lại mật khẩu',
    expiry: (value) => `Liên kết này có hiệu lực trong ${value}.`,
    ignore: 'Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.',
    fallback: 'Nếu nút không hoạt động, hãy mở đường dẫn sau trong trình duyệt:',
  },
  en: {
    activationSubject: 'Activate your Smart Queue Assistant account',
    resetSubject: 'Reset your Smart Queue Assistant password',
    greeting: (name) => `Hello ${name},`,
    activationBody: (organizationName) =>
      `The service application for ${organizationName} has been approved. Set a password using the button below to activate your account.`,
    resetBody:
      'We received a request to reset your password. Use the button below to choose a new password.',
    activationCta: 'Activate account',
    resetCta: 'Reset password',
    expiry: (value) => `This link expires in ${value}.`,
    ignore: 'If you did not request this action, you can ignore this email.',
    fallback: 'If the button does not open, paste this URL into your browser:',
  },
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function renderAccountEmail(input: EmailTemplateInput): RenderedEmail {
  const copy = COPY[input.locale] ?? COPY.ja;
  const activation = input.templateKey === 'account_activation';
  const organizationName = input.organizationName ?? 'Smart Queue Assistant';
  const body = activation ? copy.activationBody(organizationName) : copy.resetBody;
  const cta = activation ? copy.activationCta : copy.resetCta;
  const subject = activation ? copy.activationSubject : copy.resetSubject;
  const expiry = input.expiresIn ? copy.expiry(input.expiresIn) : '';
  const text = [
    copy.greeting(input.displayName),
    body,
    expiry,
    `${cta}: ${input.actionUrl}`,
    copy.ignore,
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    subject,
    text,
    html: `<!doctype html>
<html lang="${input.locale}">
  <body style="margin:0;background:#f3f5f7;font-family:Arial,sans-serif;color:#111827">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center" style="padding:32px 16px">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border:1px solid #e5e7eb">
            <tr><td style="padding:28px 32px;border-bottom:4px solid #06c755"><strong>Smart Queue Assistant</strong></td></tr>
            <tr>
              <td style="padding:32px">
                <p style="margin:0 0 20px">${escapeHtml(copy.greeting(input.displayName))}</p>
                <p style="margin:0 0 24px;line-height:1.7">${escapeHtml(body)}</p>
                <p style="margin:0 0 24px">
                  <a href="${escapeHtml(input.actionUrl)}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:13px 22px;font-weight:700">${escapeHtml(cta)}</a>
                </p>
                ${expiry ? `<p style="color:#6b7280;font-size:13px">${escapeHtml(expiry)}</p>` : ''}
                <p style="margin:24px 0 8px;color:#6b7280;font-size:13px">${escapeHtml(copy.fallback)}</p>
                <p style="margin:0;word-break:break-all;font-size:12px;color:#4b5563">${escapeHtml(input.actionUrl)}</p>
                <p style="margin:28px 0 0;color:#6b7280;font-size:13px">${escapeHtml(copy.ignore)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  };
}
