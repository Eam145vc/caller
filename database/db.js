const { Pool } = require('pg');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let db;

if (process.env.DATABASE_URL) {
    // We are in Production (Railway with Postgres)
    console.log("🐘 Connecting to PostgreSQL...");
    db = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });

    // Helper to mimic better-sqlite3 'prepare().get()' or 'prepare().run()'
    // This makes the transition smoother without rewriting every single file
    db.prepare = (sql) => {
        return {
            get: async (...params) => {
                const res = await db.query(sql.replace(/\?/g, (match, i) => `$${i + 1}`), params);
                return res.rows[0];
            },
            run: async (...params) => {
                return await db.query(sql.replace(/\?/g, (match, i) => `$${i + 1}`), params);
            },
            all: async (...params) => {
                const res = await db.query(sql.replace(/\?/g, (match, i) => `$${i + 1}`), params);
                return res.rows;
            }
        };
    };

    // Initialize Schema for Postgres if needed
    // Note: Better to do this via a migration, but for now we'll check if tables exist
    const initPostgres = async () => {
        try {
            const schema = fs.readFileSync(path.join(__dirname, 'schema_postgres.sql'), 'utf8');
            await db.query(schema);
            console.log("✅ PostgreSQL Schema Synchronized");
        } catch (err) {
            console.error("❌ Error initializing PostgreSQL:", err);
        }
    };
    initPostgres();

} else {
    // We are in Local (SQLite)
    console.log("📁 Connecting to SQLite...");
    const dbPath = path.join(__dirname, 'coldcall.db');
    const sqliteDb = new Database(dbPath);
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    sqliteDb.exec(schema);

    // Polyfill for async compatibility if we start using await in routes
    db = sqliteDb;
}

module.exports = db;
