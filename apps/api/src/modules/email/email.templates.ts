import type { SupportedLocale } from '@line-queue/shared';

import type { EmailTemplateInput, RenderedEmail } from './email.types';

type Copy = {
  activationSubject: string;
  resetSubject: string;
  applicationSubmittedSubject: (referenceCode: string) => string;
  applicationRejectedSubject: (referenceCode: string) => string;
  greeting: (name: string) => string;
  activationBody: (organizationName: string) => string;
  resetBody: string;
  applicationSubmittedBody: (organizationName: string) => string;
  applicationRejectedBody: (organizationName: string) => string;
  activationCta: string;
  resetCta: string;
  expiry: (value: string) => string;
  ignore: string;
  fallback: string;
  applicationSummaryTitle: string;
  referenceCodeLabel: string;
  planLabel: string;
  locationCountLabel: string;
  amountLabel: string;
  reviewNoteLabel: string;
  replyGuidance: string;
};

const COPY: Record<SupportedLocale, Copy> = {
  ja: {
    activationSubject: 'Smart Queue Assistant アカウントの有効化',
    resetSubject: 'Smart Queue Assistant パスワード再設定',
    applicationSubmittedSubject: (referenceCode) =>
      `Smart Queue Assistant 申し込み受付のお知らせ（${referenceCode}）`,
    applicationRejectedSubject: (referenceCode) =>
      `Smart Queue Assistant 申し込み審査結果のお知らせ（${referenceCode}）`,
    greeting: (name) => `${name} 様`,
    activationBody: (organizationName) =>
      `${organizationName} の利用申請が承認されました。下のボタンからパスワードを設定し、アカウントを有効化してください。`,
    resetBody:
      'パスワード再設定のリクエストを受け付けました。下のボタンから新しいパスワードを設定してください。',
    applicationSubmittedBody: (organizationName) =>
      `${organizationName} のサービス申し込みを受け付けました。運営チームが内容を確認しており、審査完了後に改めてご連絡します。`,
    applicationRejectedBody: (organizationName) =>
      `${organizationName} のサービス申し込みを確認しましたが、今回は承認できませんでした。`,
    activationCta: 'アカウントを有効化',
    resetCta: 'パスワードを再設定',
    expiry: (value) => `このリンクの有効期限は ${value} です。`,
    ignore: 'この操作に心当たりがない場合は、このメールを破棄してください。',
    fallback: 'ボタンを開けない場合は、次のURLをブラウザに貼り付けてください。',
    applicationSummaryTitle: '申し込み内容',
    referenceCodeLabel: '受付番号',
    planLabel: '選択プラン',
    locationCountLabel: '導入予定拠点数',
    amountLabel: 'デモ決済金額',
    reviewNoteLabel: '審査メモ',
    replyGuidance:
      '内容にご不明点や修正がある場合は、このメールに返信して運営チームへご連絡ください。',
  },
  vi: {
    activationSubject: 'Kích hoạt tài khoản Smart Queue Assistant',
    resetSubject: 'Đặt lại mật khẩu Smart Queue Assistant',
    applicationSubmittedSubject: (referenceCode) =>
      `Smart Queue Assistant đã nhận hồ sơ đăng ký (${referenceCode})`,
    applicationRejectedSubject: (referenceCode) =>
      `Kết quả xét duyệt hồ sơ Smart Queue Assistant (${referenceCode})`,
    greeting: (name) => `Xin chào ${name},`,
    activationBody: (organizationName) =>
      `Hồ sơ đăng ký của ${organizationName} đã được chấp thuận. Hãy đặt mật khẩu để kích hoạt tài khoản bằng nút bên dưới.`,
    resetBody:
      'Hệ thống đã nhận được yêu cầu đặt lại mật khẩu. Hãy tạo mật khẩu mới bằng nút bên dưới.',
    applicationSubmittedBody: (organizationName) =>
      `Hệ thống đã nhận hồ sơ đăng ký dịch vụ của ${organizationName}. Đội ngũ vận hành đang xét duyệt và sẽ phản hồi sau khi hoàn tất.`,
    applicationRejectedBody: (organizationName) =>
      `Hệ thống đã xét duyệt hồ sơ đăng ký dịch vụ của ${organizationName}, nhưng hiện chưa thể phê duyệt hồ sơ này.`,
    activationCta: 'Kích hoạt tài khoản',
    resetCta: 'Đặt lại mật khẩu',
    expiry: (value) => `Liên kết này có hiệu lực trong ${value}.`,
    ignore: 'Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.',
    fallback: 'Nếu nút không hoạt động, hãy mở đường dẫn sau trong trình duyệt:',
    applicationSummaryTitle: 'Thông tin hồ sơ',
    referenceCodeLabel: 'Mã hồ sơ',
    planLabel: 'Gói đã chọn',
    locationCountLabel: 'Số địa điểm dự kiến',
    amountLabel: 'Số tiền thanh toán demo',
    reviewNoteLabel: 'Ghi chú xét duyệt',
    replyGuidance:
      'Nếu có điểm cần bổ sung hoặc cần trao đổi thêm, hãy reply email này để liên hệ đội ngũ vận hành.',
  },
  en: {
    activationSubject: 'Activate your Smart Queue Assistant account',
    resetSubject: 'Reset your Smart Queue Assistant password',
    applicationSubmittedSubject: (referenceCode) =>
      `Smart Queue Assistant application received (${referenceCode})`,
    applicationRejectedSubject: (referenceCode) =>
      `Smart Queue Assistant application review result (${referenceCode})`,
    greeting: (name) => `Hello ${name},`,
    activationBody: (organizationName) =>
      `The service application for ${organizationName} has been approved. Set a password using the button below to activate your account.`,
    resetBody:
      'We received a request to reset your password. Use the button below to choose a new password.',
    applicationSubmittedBody: (organizationName) =>
      `We received the service application for ${organizationName}. Our operations team is reviewing it and will contact you after review.`,
    applicationRejectedBody: (organizationName) =>
      `We reviewed the service application for ${organizationName}, but cannot approve it at this time.`,
    activationCta: 'Activate account',
    resetCta: 'Reset password',
    expiry: (value) => `This link expires in ${value}.`,
    ignore: 'If you did not request this action, you can ignore this email.',
    fallback: 'If the button does not open, paste this URL into your browser:',
    applicationSummaryTitle: 'Application summary',
    referenceCodeLabel: 'Reference',
    planLabel: 'Selected plan',
    locationCountLabel: 'Planned locations',
    amountLabel: 'Demo payment amount',
    reviewNoteLabel: 'Review note',
    replyGuidance:
      'If anything needs correction or clarification, reply to this email to reach the operations team.',
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
  const reset = input.templateKey === 'password_reset';
  const submitted = input.templateKey === 'organization_application_submitted';
  const rejected = input.templateKey === 'organization_application_rejected';
  const organizationName = input.organizationName ?? 'Smart Queue Assistant';
  const referenceCode = input.referenceCode ?? '';
  const body = activation
    ? copy.activationBody(organizationName)
    : reset
      ? copy.resetBody
      : submitted
        ? copy.applicationSubmittedBody(organizationName)
        : copy.applicationRejectedBody(organizationName);
  const cta = activation ? copy.activationCta : copy.resetCta;
  const subject = activation
    ? copy.activationSubject
    : reset
      ? copy.resetSubject
      : rejected
        ? copy.applicationRejectedSubject(referenceCode)
        : copy.applicationSubmittedSubject(referenceCode);
  const expiry = input.expiresIn ? copy.expiry(input.expiresIn) : '';
  const details = [
    referenceCode ? `${copy.referenceCodeLabel}: ${referenceCode}` : '',
    input.planName ? `${copy.planLabel}: ${input.planName}` : '',
    input.locationCount ? `${copy.locationCountLabel}: ${input.locationCount}` : '',
    input.amountYen ? `${copy.amountLabel}: ${input.amountYen}` : '',
    input.reviewNote ? `${copy.reviewNoteLabel}: ${input.reviewNote}` : '',
  ].filter(Boolean);
  const hasAction = Boolean(input.actionUrl);
  const text = [
    copy.greeting(input.displayName),
    body,
    details.length > 0 ? [copy.applicationSummaryTitle, ...details].join('\n') : '',
    expiry,
    hasAction ? `${cta}: ${input.actionUrl}` : '',
    hasAction ? copy.ignore : copy.replyGuidance,
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
                ${
                  details.length > 0
                    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;border:1px solid #e5e7eb">
                  <tr><td colspan="2" style="padding:12px 14px;background:#f9fafb;font-weight:700">${escapeHtml(copy.applicationSummaryTitle)}</td></tr>
                  ${details
                    .map((detail) => {
                      const [label, ...rest] = detail.split(': ');
                      return `<tr><td style="width:38%;padding:10px 14px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:13px">${escapeHtml(label ?? '')}</td><td style="padding:10px 14px;border-top:1px solid #e5e7eb">${escapeHtml(rest.join(': '))}</td></tr>`;
                    })
                    .join('')}
                </table>`
                    : ''
                }
                ${
                  hasAction
                    ? `<p style="margin:0 0 24px">
                  <a href="${escapeHtml(input.actionUrl ?? '')}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:13px 22px;font-weight:700">${escapeHtml(cta)}</a>
                </p>`
                    : ''
                }
                ${expiry ? `<p style="color:#6b7280;font-size:13px">${escapeHtml(expiry)}</p>` : ''}
                ${
                  hasAction
                    ? `<p style="margin:24px 0 8px;color:#6b7280;font-size:13px">${escapeHtml(copy.fallback)}</p>
                <p style="margin:0;word-break:break-all;font-size:12px;color:#4b5563">${escapeHtml(input.actionUrl ?? '')}</p>`
                    : ''
                }
                <p style="margin:28px 0 0;color:#6b7280;font-size:13px">${escapeHtml(hasAction ? copy.ignore : copy.replyGuidance)}</p>
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
