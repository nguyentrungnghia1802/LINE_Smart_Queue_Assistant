import { config } from '../../../config';
import { GoogleRoutesTravelTimeProvider, MockTravelTimeProvider } from '../travel-time.provider';

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

describe('GoogleRoutesTravelTimeProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('uses walking routes and selects the longest returned duration', async () => {
    jest.replaceProperty(config.location, 'googleRoutesApiKey', 'test-key');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        routes: [
          { duration: '600s', distanceMeters: 800 },
          { duration: '900s', distanceMeters: 1100 },
        ],
      }),
    }) as jest.Mock;

    const provider = new GoogleRoutesTravelTimeProvider();
    await expect(
      provider.estimate({
        distanceMeters: 700,
        origin: { latitude: 21.02, longitude: 105.84 },
        destination: { latitude: 21.03, longitude: 105.85 },
      })
    ).resolves.toEqual({
      durationSeconds: 900,
      distanceMeters: 1100,
      provider: 'google-routes-walking-v2',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://routes.googleapis.com/directions/v2:computeRoutes',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"travelMode":"WALK"'),
      })
    );
  });
});
