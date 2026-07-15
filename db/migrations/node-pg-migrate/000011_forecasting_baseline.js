module.exports.shorthands = undefined;

module.exports.up = async (pgm) => {
  pgm.sql(String.raw`
CREATE TABLE queue_hourly_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL,
  hour_of_day INT NOT NULL,
  sample_start TIMESTAMPTZ NOT NULL,
  sample_end TIMESTAMPTZ NOT NULL,
  arrival_count INT NOT NULL DEFAULT 0,
  completion_count INT NOT NULL DEFAULT 0,
  average_wait_seconds INT,
  average_service_seconds INT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT queue_hourly_metrics_day CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT queue_hourly_metrics_hour CHECK (hour_of_day BETWEEN 0 AND 23),
  CONSTRAINT queue_hourly_metrics_counts CHECK (arrival_count >= 0 AND completion_count >= 0),
  CONSTRAINT queue_hourly_metrics_duration CHECK (
    (average_wait_seconds IS NULL OR average_wait_seconds >= 0)
    AND (average_service_seconds IS NULL OR average_service_seconds >= 0)
  ),
  CONSTRAINT queue_hourly_metrics_window CHECK (sample_start < sample_end)
);

ALTER TABLE wait_time_forecasts
  ADD COLUMN explanation TEXT,
  ADD COLUMN expires_at TIMESTAMPTZ;
UPDATE wait_time_forecasts SET expires_at = generated_at + INTERVAL '90 days' WHERE expires_at IS NULL;
ALTER TABLE wait_time_forecasts ALTER COLUMN expires_at SET NOT NULL;

ALTER TABLE staffing_recommendations
  ADD COLUMN explanation TEXT,
  ADD COLUMN expires_at TIMESTAMPTZ;
UPDATE staffing_recommendations SET expires_at = generated_at + INTERVAL '90 days' WHERE expires_at IS NULL;
ALTER TABLE staffing_recommendations ALTER COLUMN expires_at SET NOT NULL;

CREATE INDEX idx_queue_hourly_metrics_slot
  ON queue_hourly_metrics(organization_id, day_of_week, hour_of_day, generated_at DESC);
CREATE INDEX idx_queue_hourly_metrics_expiry ON queue_hourly_metrics(expires_at);
CREATE INDEX idx_wait_time_forecasts_queue_latest
  ON wait_time_forecasts(organization_id, queue_id, generated_at DESC);
CREATE INDEX idx_wait_time_forecasts_expiry ON wait_time_forecasts(expires_at);
CREATE INDEX idx_staffing_recommendations_latest
  ON staffing_recommendations(organization_id, day_of_week, hour_of_day, generated_at DESC);
CREATE INDEX idx_staffing_recommendations_expiry ON staffing_recommendations(expires_at);
  `);
};

module.exports.down = async (pgm) => {
  pgm.sql(String.raw`
DROP INDEX IF EXISTS idx_staffing_recommendations_expiry;
DROP INDEX IF EXISTS idx_staffing_recommendations_latest;
DROP INDEX IF EXISTS idx_wait_time_forecasts_expiry;
DROP INDEX IF EXISTS idx_wait_time_forecasts_queue_latest;
DROP INDEX IF EXISTS idx_queue_hourly_metrics_expiry;
DROP INDEX IF EXISTS idx_queue_hourly_metrics_slot;
ALTER TABLE staffing_recommendations DROP COLUMN IF EXISTS expires_at, DROP COLUMN IF EXISTS explanation;
ALTER TABLE wait_time_forecasts DROP COLUMN IF EXISTS expires_at, DROP COLUMN IF EXISTS explanation;
DROP TABLE IF EXISTS queue_hourly_metrics;
  `);
};
