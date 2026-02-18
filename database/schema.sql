-- Business leads scraped from Google Maps
CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT, -- Cleaned phone number
    address TEXT,
    city TEXT,
    business_type TEXT,
    has_website BOOLEAN DEFAULT 0,
    website_url TEXT,
    status TEXT DEFAULT 'new', -- new, contacted, interested, dedicated, not_interested, voicemail
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Calling campaigns
CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    city TEXT,
    business_type TEXT,
    status TEXT DEFAULT 'active', -- active, paused, completed
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Call history
CREATE TABLE IF NOT EXISTS calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER,
    campaign_id INTEGER,
    twilio_call_sid TEXT,
    duration_seconds INTEGER,
    outcome TEXT, -- connected, voicemail, busy, failed
    transcript TEXT,
    summary TEXT,
    recording_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(lead_id) REFERENCES leads(id),
    FOREIGN KEY(campaign_id) REFERENCES campaigns(id)
);

-- Scheduled appointments
CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER,
    scheduled_at DATETIME NOT NULL, -- The date/time of the appointment
    status TEXT DEFAULT 'scheduled', -- scheduled, completed, cancelled, no_show
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(lead_id) REFERENCES leads(id)
);

-- System settings
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
