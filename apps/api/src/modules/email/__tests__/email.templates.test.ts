import { renderAccountEmail } from '../email.templates';

describe('business account email templates', () => {
  it.each([
    ['ja', 'アカウント'],
    ['vi', 'Kích hoạt'],
    ['en', 'Activate'],
  ] as const)('renders localized activation content for %s', (locale, expected) => {
    const email = renderAccountEmail({
      templateKey: 'account_activation',
      locale,
      displayName: 'Owner',
      organizationName: 'Example',
      actionUrl: 'https://queue.example.com/activate-account?token=test',
      expiresIn: '72',
    });
    expect(email.subject).toContain(expected);
    expect(email.html).toContain('https://queue.example.com/activate-account?token=test');
    expect(email.text).toContain('Owner');
  });

  it('escapes user-controlled HTML content', () => {
    const email = renderAccountEmail({
      templateKey: 'password_reset',
      locale: 'ja',
      displayName: '<script>alert(1)</script>',
      actionUrl: 'https://queue.example.com/reset-password?token=test',
    });
    expect(email.html).not.toContain('<script>alert(1)</script>');
    expect(email.html).toContain('&lt;script&gt;');
  });

  it('renders application submitted content without an action URL', () => {
    const email = renderAccountEmail({
      templateKey: 'organization_application_submitted',
      locale: 'vi',
      displayName: 'Owner',
      organizationName: 'Demo Business',
      referenceCode: 'SQA-1234ABCD',
      planName: 'Standard',
      locationCount: '3',
      amountYen: '¥29,800',
    });

    expect(email.subject).toContain('SQA-1234ABCD');
    expect(email.text).toContain('Đội ngũ vận hành đang xét duyệt');
    expect(email.text).toContain('Standard');
    expect(email.html).not.toContain('href=""');
  });

  it('renders application rejected content with a review note', () => {
    const email = renderAccountEmail({
      templateKey: 'organization_application_rejected',
      locale: 'ja',
      displayName: 'Owner',
      organizationName: 'Demo Business',
      referenceCode: 'SQA-REJECT',
      reviewNote: '追加資料が必要です。',
    });

    expect(email.subject).toContain('SQA-REJECT');
    expect(email.text).toContain('承認できませんでした');
    expect(email.text).toContain('追加資料が必要です。');
  });
});
