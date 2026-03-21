-- Initial Vexil database schema

CREATE TABLE IF NOT EXISTS audit_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor       TEXT NOT NULL DEFAULT 'system',
    action      TEXT NOT NULL,
    resource    TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    cluster     TEXT,
    diff        JSONB,
    metadata    JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_timestamp ON audit_events (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_resource ON audit_events (resource, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_cluster ON audit_events (cluster);
CREATE INDEX IF NOT EXISTS idx_audit_events_action ON audit_events (action);

CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL DEFAULT '',
    role          TEXT NOT NULL DEFAULT 'viewer',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cluster_cache (
    cluster_id   TEXT PRIMARY KEY,
    display_name TEXT,
    status       TEXT,
    version      TEXT,
    workloads    JSONB,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
