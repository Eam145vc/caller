const express = require('express');
const router = express.Router();

const db = require('../database/db');

router.get('/appointments', async (req, res) => {
    try {
        const appointments = await Promise.resolve(db.prepare(`
            SELECT a.id, a.scheduled_at, a.notes, a.status as apt_status, 
                   COALESCE(l.name, 'Usuario Test/Desconocido') as lead_name, 
                   COALESCE(l.business_type, 'N/A') as business_type
            FROM appointments a
            LEFT JOIN leads l ON a.lead_id = l.id
            ORDER BY a.created_at DESC
        `).all());

        res.json(appointments || []);
    } catch (e) {
        console.error("Error fetching appointments:", e);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
