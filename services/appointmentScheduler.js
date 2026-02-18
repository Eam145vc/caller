const db = require('../database/db');

function createAppointment(leadId, date, time, notes) {
    try {
        const stmt = db.prepare(`
            INSERT INTO appointments (lead_id, scheduled_at, notes, status)
            VALUES (?, ?, ?, 'scheduled')
        `);

        const scheduledAt = `${date} ${time}:00`;
        const result = stmt.run(leadId, scheduledAt, notes);

        console.log(`Appointment created for Lead ${leadId} at ${scheduledAt}`);
        return result.lastInsertRowid;
    } catch (error) {
        console.error("Error creating appointment:", error);
        throw error;
    }
}

module.exports = { createAppointment };
