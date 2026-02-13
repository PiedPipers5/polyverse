-- Migration: Add GIN index on activities.activity JSONB column
-- This index improves performance for filtering activities by to/cc fields (User Story 2.3)

CREATE INDEX IF NOT EXISTS activities_activity_gin_idx ON activities USING gin (activity);
