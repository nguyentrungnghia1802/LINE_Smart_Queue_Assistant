export interface TravelTimeEstimate {
  distanceMeters: number;
  durationSeconds: number;
  provider: string;
}

export interface TravelTimeProvider {
  estimate(input: { distanceMeters: number }): Promise<TravelTimeEstimate>;
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

export const travelTimeProvider: TravelTimeProvider = new MockTravelTimeProvider();
