require('dotenv').config();
const db = require('./database/db');

async function check() {
    try {
        console.log("Creating lead...");
        const res = await db.query("INSERT INTO leads (name, phone, business_type, status) VALUES ('Test', '123', 'Biz', 'new') RETURNING id");
        const id = res.rows[0].id;
        console.log("Created lead ID:", id);

        console.log("Inserting appointment with integer ID...");
        await Promise.resolve(db.prepare('INSERT INTO appointments (lead_id, scheduled_at, notes) VALUES (?, ?, ?)').run(id, "Mañana a las 5", "Test notes"));

        console.log("Inserting appointment with string ID...");
        await Promise.resolve(db.prepare('INSERT INTO appointments (lead_id, scheduled_at, notes) VALUES (?, ?, ?)').run(String(id), "Lunes 3pm", "Test notes str"));

        console.log("Querying appointments...");
        const apts = await Promise.resolve(db.prepare("SELECT * FROM appointments").all());
        console.log(apts);
    } catch (e) {
        console.error(e);
    }
}

check();
