import { MockTravelTimeProvider } from '../travel-time.provider';

describe('MockTravelTimeProvider', () => {
  it('returns a deterministic estimate without an external API call', async () => {
    const provider = new MockTravelTimeProvider();
    await expect(provider.estimate({ distanceMeters: 1200 })).resolves.toEqual({
      distanceMeters: 1200,
      durationSeconds: 1000,
      provider: 'mock-walking-v1',
    });
  });
});
