import { pool } from '../../../db/client';
import { notificationPreferencesRepository } from '../notification-preferences.repository';

jest.mock('../../../db/client', () => ({
  pool: { query: jest.fn() },
}));

const mockQuery = pool.query as jest.MockedFunction<typeof pool.query>;

describe('notificationPreferencesRepository.syncVerifiedFriendship', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes delivery for a verified LINE friend without overriding later opt-out choices', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        {
          user_id: 'user-001',
          line_user_id: 'U123',
          follow_state: 'followed',
          notification_enabled: true,
        },
      ],
    } as never);

    await notificationPreferencesRepository.syncVerifiedFriendship({
      userId: 'user-001',
      lineUserId: 'U123',
      friendFlag: true,
    });

    const sql = String(mockQuery.mock.calls[0]?.[0]);
    expect(sql).toContain("THEN 'liff_friendship'");
    expect(sql).toContain("line_notification_preferences.follow_state = 'unknown'");
    expect(sql).toContain('ELSE line_notification_preferences.notification_enabled');
    expect(mockQuery.mock.calls[0]?.[1]).toEqual(['user-001', 'U123', true]);
  });
});
