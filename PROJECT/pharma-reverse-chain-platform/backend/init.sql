-- Pharma Reverse Chain (Option B) — PostgreSQL schema
-- Application tables + cryptographic audit ledger. No blockchain.
-- The application treats audit_events as APPEND-ONLY (no update/delete API).

CREATE TABLE IF NOT EXISTS medicine_batches (
    id SERIAL PRIMARY KEY,
    batch_number VARCHAR(100) UNIQUE NOT NULL,
    medicine_name VARCHAR(255) NOT NULL,
    manufacturer_name VARCHAR(255) NOT NULL DEFAULT 'NovaGen Labs',
    expiry_date DATE NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    current_status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    certificate_hash VARCHAR(64),
    certificate_filename VARCHAR(255),
    discrepancy_reason TEXT
);

CREATE TABLE IF NOT EXISTS audit_events (
    id BIGSERIAL PRIMARY KEY,
    batch_id VARCHAR(100) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB NOT NULL DEFAULT '{}',
    previous_hash VARCHAR(64) NOT NULL,
    event_hash VARCHAR(64) NOT NULL,
    actor_id VARCHAR(100) NOT NULL,
    actor_role VARCHAR(50) NOT NULL,
    digital_signature TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_batch_idx ON audit_events (batch_id);
CREATE INDEX IF NOT EXISTS audit_ts_idx ON audit_events (timestamp);
CREATE INDEX IF NOT EXISTS audit_hash_idx ON audit_events (event_hash);
CREATE INDEX IF NOT EXISTS audit_prev_idx ON audit_events (previous_hash);

CREATE TABLE IF NOT EXISTS fraud_alerts (
    alert_id SERIAL PRIMARY KEY,
    batch_number VARCHAR(100) NOT NULL,
    pharmacy_name VARCHAR(255) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    batch_status VARCHAR(50) NOT NULL
);
CREATE INDEX IF NOT EXISTS alerts_batch_idx ON fraud_alerts (batch_number);

CREATE TABLE IF NOT EXISTS actors (
    id SERIAL PRIMARY KEY,
    actor_id VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    location VARCHAR(255) NOT NULL DEFAULT '—',
    public_key TEXT
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    actor_id VARCHAR(100) NOT NULL REFERENCES actors(actor_id),
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Production hardening (OPTIONAL — leave OFF in demo so tamper-detection can be shown):
-- REVOKE UPDATE, DELETE ON audit_events FROM pharma;
