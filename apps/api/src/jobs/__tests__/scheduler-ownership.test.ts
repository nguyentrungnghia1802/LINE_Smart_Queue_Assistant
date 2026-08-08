import { apiOwnsNotificationDelivery } from '../scheduler';

describe('notification delivery scheduler ownership', () => {
  it('keeps bare local development compatible with API ownership', () => {
    expect(apiOwnsNotificationDelivery('api')).toBe(true);
  });

  it('removes the API scheduler when BullMQ owns delivery', () => {
    expect(apiOwnsNotificationDelivery('bullmq')).toBe(false);
  });
});
