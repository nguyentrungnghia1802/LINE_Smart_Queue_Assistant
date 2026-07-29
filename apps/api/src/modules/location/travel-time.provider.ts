import { config } from '../../config';
import { AppError } from '../../utils/AppError';

export interface TravelTimeEstimate {
  distanceMeters: number;
  durationSeconds: number;
  provider: string;
}

export interface TravelTimeProvider {
  estimate(input: {
    distanceMeters: number;
    origin: { latitude: number; longitude: number };
    destination: { latitude: number; longitude: number };
  }): Promise<TravelTimeEstimate>;
}

export class MockTravelTimeProvider implements TravelTimeProvider {
  async estimate(input: { distanceMeters: number }): Promise<TravelTimeEstimate> {
    return {
      distanceMeters: input.distanceMeters,
      durationSeconds: Math.ceil(input.distanceMeters / 1.2),
      provider: 'mock-walking-v1',
    };
  }
}

interface GoogleRoutesResponse {
  routes?: Array<{ duration?: string; distanceMeters?: number }>;
}

export class GoogleRoutesTravelTimeProvider implements TravelTimeProvider {
  async estimate(input: {
    distanceMeters: number;
    origin: { latitude: number; longitude: number };
    destination: { latitude: number; longitude: number };
  }): Promise<TravelTimeEstimate> {
    if (!config.location.googleRoutesApiKey) {
      throw new AppError(
        'GOOGLE_ROUTES_API_KEY is required for the Google Routes travel provider',
        503,
        'TRAVEL_PROVIDER_NOT_CONFIGURED'
      );
    }

    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': config.location.googleRoutesApiKey,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters',
      },
      body: JSON.stringify({
        origin: { location: { latLng: input.origin } },
        destination: { location: { latLng: input.destination } },
        travelMode: 'WALK',
        computeAlternativeRoutes: true,
        units: 'METRIC',
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new AppError(
        `Google Routes returned HTTP ${response.status}`,
        502,
        'TRAVEL_PROVIDER_ERROR'
      );
    }

    const payload = (await response.json()) as GoogleRoutesResponse;
    const routes = (payload.routes ?? [])
      .map((route) => ({
        distanceMeters: Number(route.distanceMeters ?? 0),
        durationSeconds: parseDurationSeconds(route.duration),
      }))
      .filter((route) => route.distanceMeters > 0 && route.durationSeconds > 0);
    if (routes.length === 0) {
      throw new AppError('Google Routes returned no walking route', 502, 'TRAVEL_ROUTE_NOT_FOUND');
    }

    const longestRoute = routes.reduce((longest, route) =>
      route.durationSeconds > longest.durationSeconds ? route : longest
    );
    return { ...longestRoute, provider: 'google-routes-walking-v2' };
  }
}

function parseDurationSeconds(value?: string): number {
  if (!value?.endsWith('s')) return 0;
  const seconds = Number.parseFloat(value.slice(0, -1));
  return Number.isFinite(seconds) ? Math.ceil(seconds) : 0;
}

export const travelTimeProvider: TravelTimeProvider =
  (config.location?.travelProvider ?? 'mock') === 'google_routes'
    ? new GoogleRoutesTravelTimeProvider()
    : new MockTravelTimeProvider();
