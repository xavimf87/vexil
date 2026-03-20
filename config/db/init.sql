-- Vexil database initialization

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

CREATE INDEX idx_audit_events_timestamp ON audit_events (timestamp DESC);
CREATE INDEX idx_audit_events_resource ON audit_events (resource, resource_id);
CREATE INDEX idx_audit_events_cluster ON audit_events (cluster);
CREATE INDEX idx_audit_events_action ON audit_events (action);

CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       TEXT UNIQUE NOT NULL,
    name        TEXT,
    role        TEXT NOT NULL DEFAULT 'viewer',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS cluster_cache (
    cluster_id  TEXT PRIMARY KEY,
    display_name TEXT,
    status      TEXT,
    version     TEXT,
    workloads   JSONB,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed a default admin user
INSERT INTO users (email, name, role) VALUES ('admin@vexil.io', 'Admin', 'admin')
ON CONFLICT DO NOTHING;
