jest.mock('../forecasts.repository');

import { buildStaffingRecommendation, buildWaitForecast } from '../forecasts.service';

describe('measured forecasting heuristic', () => {
  it('scales staffing from measured demand and service duration', () => {
    const result = buildStaffingRecommendation({
      organization_id: 'org-1',
      day_of_week: 1,
      hour_of_day: 10,
      arrival_count: 80,
      completion_count: 64,
      average_wait_seconds: 600,
      average_service_seconds: 1800,
      active_staff_count: 3,
    });

    expect(result.recommendedStaff).toBe(7);
    expect(result.confidence).toBe(0.9);
    expect(result.explanation).toContain('80 arrivals');
    expect(result.explanation).toContain('30 minutes');
  });

  it('uses a conservative baseline when no history exists', () => {
    const result = buildStaffingRecommendation({
      organization_id: 'org-1',
      day_of_week: 0,
      hour_of_day: 8,
      arrival_count: 0,
      completion_count: 0,
      average_wait_seconds: null,
      average_service_seconds: null,
      active_staff_count: 1,
    });

    expect(result).toMatchObject({ recommendedStaff: 1, confidence: 0.2 });
    expect(result.explanation).toContain('No observations');
  });

  it('reduces current wait by active staff and reports confidence from sample size', () => {
    const result = buildWaitForecast({
      organization_id: 'org-1',
      queue_id: 'queue-1',
      queue_name: '受付',
      queue_depth: 6,
      active_staff_count: 3,
      average_service_seconds: 900,
      historical_sample_count: 20,
    });

    expect(result.forecastedWaitSeconds).toBe(1800);
    expect(result.confidence).toBe(0.8);
    expect(result.explanation).toContain('3 active staff');
  });
});
