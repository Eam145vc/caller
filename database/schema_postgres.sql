-- PostgreSQL Compatible Schema

CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    city TEXT,
    business_type TEXT,
    has_website BOOLEAN DEFAULT FALSE,
    website_url TEXT,
    status TEXT DEFAULT 'new',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS campaigns (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    city TEXT,
    business_type TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS calls (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id),
    campaign_id INTEGER REFERENCES campaigns(id),
    twilio_call_sid TEXT,
    duration_seconds INTEGER,
    outcome TEXT,
    transcript TEXT,
    summary TEXT,
    recording_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id),
    scheduled_at TIMESTAMP NOT NULL,
    status TEXT DEFAULT 'scheduled',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
