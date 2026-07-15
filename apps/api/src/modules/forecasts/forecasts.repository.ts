import type { PoolClient } from 'pg';

import { pool } from '../../db/client';

export interface HistoricalSlot {
  organization_id: string;
  day_of_week: number;
  hour_of_day: number;
  arrival_count: number;
  completion_count: number;
  average_wait_seconds: number | null;
  average_service_seconds: number | null;
  active_staff_count: number;
}

export interface CurrentQueueLoad {
  organization_id: string;
  queue_id: string;
  queue_name: string;
  queue_depth: number;
  active_staff_count: number;
  average_service_seconds: number;
  historical_sample_count: number;
}

export const forecastsRepository = {
  async loadHistoricalSlots(): Promise<HistoricalSlot[]> {
    const result = await pool.query<HistoricalSlot>(`
      WITH slots AS (
        SELECT o.id AS organization_id, o.timezone, day_of_week, hour_of_day
        FROM organizations o
        CROSS JOIN generate_series(0, 6) AS day_of_week
        CROSS JOIN generate_series(0, 23) AS hour_of_day
        WHERE o.is_active = TRUE
      ), arrivals AS (
        SELECT q.organization_id,
               EXTRACT(DOW FROM qe.created_at AT TIME ZONE o.timezone)::int AS day_of_week,
               EXTRACT(HOUR FROM qe.created_at AT TIME ZONE o.timezone)::int AS hour_of_day,
               COUNT(*)::int AS arrival_count
        FROM queue_entries qe
        JOIN queues q ON q.id = qe.queue_id
        JOIN organizations o ON o.id = q.organization_id
        WHERE qe.created_at >= NOW() - INTERVAL '56 days'
        GROUP BY q.organization_id, day_of_week, hour_of_day
      ), completions AS (
        SELECT qh.organization_id,
               EXTRACT(DOW FROM qh.created_at AT TIME ZONE o.timezone)::int AS day_of_week,
               EXTRACT(HOUR FROM qh.created_at AT TIME ZONE o.timezone)::int AS hour_of_day,
               COUNT(*)::int AS completion_count,
               ROUND(AVG(qh.wait_seconds))::int AS average_wait_seconds,
               ROUND(AVG(qh.service_seconds))::int AS average_service_seconds
        FROM queue_histories qh
        JOIN organizations o ON o.id = qh.organization_id
        WHERE qh.to_status = 'served'
          AND qh.created_at >= NOW() - INTERVAL '56 days'
        GROUP BY qh.organization_id, day_of_week, hour_of_day
      ), staffing AS (
        SELECT organization_id, COUNT(*)::int AS active_staff_count
        FROM organization_members
        WHERE is_active = TRUE AND role IN ('manager', 'staff')
        GROUP BY organization_id
      )
      SELECT s.organization_id, s.day_of_week, s.hour_of_day,
             COALESCE(a.arrival_count, 0)::int AS arrival_count,
             COALESCE(c.completion_count, 0)::int AS completion_count,
             c.average_wait_seconds, c.average_service_seconds,
             GREATEST(COALESCE(st.active_staff_count, 0), 1)::int AS active_staff_count
      FROM slots s
      LEFT JOIN arrivals a USING (organization_id, day_of_week, hour_of_day)
      LEFT JOIN completions c USING (organization_id, day_of_week, hour_of_day)
      LEFT JOIN staffing st USING (organization_id)
      ORDER BY s.organization_id, s.day_of_week, s.hour_of_day
    `);
    return result.rows;
  },

  async loadCurrentQueueLoads(): Promise<CurrentQueueLoad[]> {
    const result = await pool.query<CurrentQueueLoad>(`
      SELECT q.organization_id, q.id AS queue_id, q.name AS queue_name,
             COUNT(qe.id) FILTER (WHERE qe.status IN ('waiting','called'))::int AS queue_depth,
             GREATEST(COALESCE((
               SELECT COUNT(*) FROM organization_members om
               WHERE om.organization_id = q.organization_id
                 AND om.is_active = TRUE AND om.role IN ('manager','staff')
             ), 0), 1)::int AS active_staff_count,
             COALESCE(ROUND((
               SELECT AVG(qh.service_seconds) FROM queue_histories qh
               WHERE qh.queue_id = q.id AND qh.to_status = 'served'
                 AND qh.created_at >= NOW() - INTERVAL '28 days'
             )), q.avg_service_seconds)::int AS average_service_seconds,
             COALESCE((
               SELECT COUNT(*) FROM queue_histories qh
               WHERE qh.queue_id = q.id AND qh.to_status = 'served'
                 AND qh.created_at >= NOW() - INTERVAL '28 days'
             ), 0)::int AS historical_sample_count
      FROM queues q
      LEFT JOIN queue_entries qe ON qe.queue_id = q.id AND qe.status IN ('waiting','called')
      WHERE q.is_active = TRUE AND q.status = 'open'
      GROUP BY q.id
      ORDER BY q.organization_id, q.name
    `);
    return result.rows;
  },

  async saveCycle(
    slots: Array<
      HistoricalSlot & { recommendedStaff: number; confidence: number; explanation: string }
    >,
    queues: Array<
      CurrentQueueLoad & { forecastedWaitSeconds: number; confidence: number; explanation: string }
    >,
    retentionDays: number
  ) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const sampleEnd = new Date();
      const sampleStart = new Date(sampleEnd.getTime() - 56 * 86_400_000);
      const expiresAt = new Date(sampleEnd.getTime() + retentionDays * 86_400_000);
      for (const slot of slots) {
        await this.insertSlot(client, slot, sampleStart, sampleEnd, expiresAt);
      }
      for (const queue of queues) {
        await client.query(
          `INSERT INTO wait_time_forecasts
             (organization_id, queue_id, forecasted_wait_seconds, queue_depth,
              active_staff_count, confidence, model_version, features, explanation, expires_at)
           VALUES ($1,$2,$3,$4,$5,$6,'measured-heuristic-v1',$7,$8,$9)`,
          [
            queue.organization_id,
            queue.queue_id,
            queue.forecastedWaitSeconds,
            queue.queue_depth,
            queue.active_staff_count,
            queue.confidence,
            JSON.stringify({
              averageServiceSeconds: queue.average_service_seconds,
              historicalSampleCount: queue.historical_sample_count,
            }),
            queue.explanation,
            expiresAt,
          ]
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async insertSlot(
    client: PoolClient,
    slot: HistoricalSlot & { recommendedStaff: number; confidence: number; explanation: string },
    sampleStart: Date,
    sampleEnd: Date,
    expiresAt: Date
  ) {
    await client.query(
      `INSERT INTO queue_hourly_metrics
         (organization_id, day_of_week, hour_of_day, sample_start, sample_end,
          arrival_count, completion_count, average_wait_seconds, average_service_seconds, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        slot.organization_id,
        slot.day_of_week,
        slot.hour_of_day,
        sampleStart,
        sampleEnd,
        slot.arrival_count,
        slot.completion_count,
        slot.average_wait_seconds,
        slot.average_service_seconds,
        expiresAt,
      ]
    );
    await client.query(
      `INSERT INTO staffing_recommendations
         (organization_id, day_of_week, hour_of_day, recommended_staff_count,
          confidence, model_version, features, explanation, expires_at)
       VALUES ($1,$2,$3,$4,$5,'measured-heuristic-v1',$6,$7,$8)`,
      [
        slot.organization_id,
        slot.day_of_week,
        slot.hour_of_day,
        slot.recommendedStaff,
        slot.confidence,
        JSON.stringify({
          arrivalCount56Days: slot.arrival_count,
          completionCount56Days: slot.completion_count,
          averageServiceSeconds: slot.average_service_seconds,
          activeStaffCount: slot.active_staff_count,
        }),
        slot.explanation,
        expiresAt,
      ]
    );
  },

  async listLatestWaitForecasts(organizationId: string) {
    const result = await pool.query(
      `SELECT DISTINCT ON (f.queue_id)
         f.id, f.queue_id, q.name AS queue_name, f.forecasted_wait_seconds,
         f.queue_depth, f.active_staff_count, f.confidence, f.model_version,
         f.explanation, f.generated_at
       FROM wait_time_forecasts f
       JOIN queues q ON q.id = f.queue_id
       WHERE f.organization_id = $1
       ORDER BY f.queue_id, f.generated_at DESC`,
      [organizationId]
    );
    return result.rows;
  },

  async listLatestStaffing(organizationId: string) {
    const result = await pool.query(
      `SELECT DISTINCT ON (day_of_week, hour_of_day)
         id, day_of_week, hour_of_day, recommended_staff_count, confidence,
         model_version, explanation, features, generated_at
       FROM staffing_recommendations
       WHERE organization_id = $1
       ORDER BY day_of_week, hour_of_day, generated_at DESC`,
      [organizationId]
    );
    return result.rows;
  },

  async deleteExpired() {
    await pool.query(`
      DELETE FROM queue_hourly_metrics WHERE expires_at < NOW();
      DELETE FROM wait_time_forecasts WHERE expires_at < NOW();
      DELETE FROM staffing_recommendations WHERE expires_at < NOW();
    `);
  },
};
