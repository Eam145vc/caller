require('dotenv').config();
const { Pool } = require('pg');

async function test() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const res = await pool.query("SELECT data_type FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'scheduled_at'");
        console.log("Column scheduled_at is type:", res.rows[0].data_type);

        // try altering
        console.log("Trying to alter...");
        await pool.query("ALTER TABLE appointments ALTER COLUMN scheduled_at TYPE TEXT");
        console.log("Alter successful!");
    } catch (e) {
        console.error("Error:", e.message);
    }
}
test();
