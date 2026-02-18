const express = require('express');
const router = express.Router();

router.get('/settings', (req, res) => {
    try {
        res.json({
            twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || 'Not Configured',
            openaiModel: 'GPT-4o Realtime',
            dailyCallLimit: 50
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
