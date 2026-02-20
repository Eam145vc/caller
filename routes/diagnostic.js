const express = require('express');
const router = express.Router();
const db = require('../database/db');

router.get('/diagnostic', async (req, res) => {
    try {
        let leads = [];
        let apts = [];

        if (db.query) {
            const lRes = await db.query("SELECT * FROM leads ORDER BY id DESC LIMIT 10");
            leads = lRes.rows;
            const aRes = await db.query("SELECT * FROM appointments ORDER BY id DESC LIMIT 10");
            apts = aRes.rows;
        } else {
            leads = await Promise.resolve(db.prepare("SELECT * FROM leads ORDER BY id DESC LIMIT 10").all());
            apts = await Promise.resolve(db.prepare("SELECT * FROM appointments ORDER BY id DESC LIMIT 10").all());
        }
        res.json({ leads, apts });
    } catch (e) {
        res.json({ error: e.message, stack: e.stack });
    }
});

module.exports = router;
