const { Pool } = require('pg');
require('dotenv').config();

async function test() {
    const db = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log("Testing with undefined");
        await db.query('SELECT * FROM leads WHERE id = $1', [undefined]);
    } catch (e) {
        console.error("UNDEFINED ERROR:", e.message);
    }

    try {
        console.log("Testing with null");
        await db.query('SELECT * FROM leads WHERE id = $1', [null]);
    } catch (e) {
        console.error("NULL ERROR:", e.message);
    }

    try {
        console.log("Testing with array containing array");
        await db.query('SELECT * FROM leads WHERE id = $1', [[1]]);
    } catch (e) {
        console.error("ARRAY ERROR:", e.message);
    }

}
test();
