const db = require('./database/db');
require('dotenv').config();

async function test() {
    try {
        console.log("Checking leads...");
        let leads = await db.query ? await db.query("SELECT id FROM leads") : db.prepare("SELECT id FROM leads").all();
        let rows = leads.rows || leads;
        console.log("Leads inside DB:", rows);

        if (rows.length > 0) {
            let leadId = rows[0].id;
            console.log("Attempting to insert appointment for lead:", leadId);
            // This isolates the exact method used by mediaStreamHandler
            let res = await db.prepare('INSERT INTO appointments (lead_id, scheduled_at, notes) VALUES (?, ?, ?)')
                .run(leadId, '2024-05-21 10:00', 'Agendado test');
            console.log("Insert result:", res);
        } else {
            console.log("No leads found, cannot test appointment insert");
        }

    } catch (e) {
        console.error("DB ERROR =>", e);
    }
}
test();
