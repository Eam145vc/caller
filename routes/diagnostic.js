const express = require('express');
const router = express.Router();
const db = require('../database/db');

router.get('/diagnostic', async (req, res) => {
    try {
        let leads = [];
        let apts = [];
        let insertTestResult = null;
        let pSqlError = null;

        try {
            // Attempt to simulate what the tool call does EXACTLY
            const resInsert = await Promise.resolve(db.prepare('INSERT INTO appointments (lead_id, scheduled_at, notes) VALUES (?, ?, ?)')
                .run(null, 'Dia de prueba', 'Test by diagnostic endpoint'));
            insertTestResult = resInsert;
        } catch (err) {
            pSqlError = err.message;
        }

        if (db.query) {
            const lRes = await db.query("SELECT * FROM leads ORDER BY id DESC LIMIT 10");
            leads = lRes.rows;
            const aRes = await db.query("SELECT * FROM appointments ORDER BY id DESC LIMIT 10");
            apts = aRes.rows;
        } else {
            leads = await Promise.resolve(db.prepare("SELECT * FROM leads ORDER BY id DESC LIMIT 10").all());
            apts = await Promise.resolve(db.prepare("SELECT * FROM appointments ORDER BY id DESC LIMIT 10").all());
        }
        res.json({ insertTestResult, pSqlError, leads, apts });
    } catch (e) {
        res.json({ error: e.message, stack: e.stack });
    }
});

module.exports = router;
