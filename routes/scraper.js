const express = require('express');
const router = express.Router();
const { scrapeBusinesses } = require('../services/scraper');
const db = require('../database/db');

// Trigger a scrape
router.post('/scrape', async (req, res) => {
    const { city, businessType, maxResults } = req.body;

    if (!city || !businessType) {
        return res.status(400).json({ error: "Missing city or businessType" });
    }

    try {
        console.log(`Received scrape request for ${businessType} in ${city}`);
        // Run in background to not block response?
        // For now, await it to show results immediately (up to a limit)
        // If maxResults is huge, we should make this async and return a job ID.

        await scrapeBusinesses(city, businessType, maxResults || 20);

        // Count how many we have now
        const count = db.prepare('SELECT count(*) as total FROM leads WHERE city = ? AND business_type = ?').get(city, businessType);

        res.json({
            success: true,
            message: `Scraping completed.`,
            total_leads: count.total
        });

    } catch (error) {
        console.error("Scrape error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Get leads
router.get('/leads', (req, res) => {
    const { city, business_type, has_website, status } = req.query;

    let query = "SELECT * FROM leads WHERE 1=1";
    const params = [];

    if (city) {
        query += " AND city = ?";
        params.push(city);
    }
    if (business_type) {
        query += " AND business_type = ?";
        params.push(business_type);
    }
    if (has_website !== undefined) {
        query += " AND has_website = ?";
        // Convert 'true'/'false' string to 1/0
        params.push(has_website === 'true' ? 1 : 0);
    }
    if (status) {
        query += " AND status = ?";
        params.push(status);
    }

    query += " ORDER BY created_at DESC";

    try {
        const leads = db.prepare(query).all(...params);
        res.json({ leads });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update lead status
router.patch('/leads/:id', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
        return res.status(400).json({ error: "Missing status" });
    }

    try {
        const result = db.prepare('UPDATE leads SET status = ? WHERE id = ?').run(status, id);
        if (result.changes === 0) {
            return res.status(404).json({ error: "Lead not found" });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
