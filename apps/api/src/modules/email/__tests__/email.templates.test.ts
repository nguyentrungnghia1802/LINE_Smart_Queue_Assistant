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
});
