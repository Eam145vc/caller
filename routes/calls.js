const express = require('express');
const router = express.Router();
const { initiateCall } = require('../services/callEngine');
const db = require('../database/db');
const VoiceResponse = require('twilio').twiml.VoiceResponse;

// Initiate a call
router.post('/calls/start', async (req, res) => {
    const { leadId } = req.body;

    if (!leadId) {
        return res.status(400).json({ error: "Missing leadId" });
    }

    try {
        const result = await initiateCall(leadId);
        res.json({ success: true, callSid: result.sid });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Twilio Voice Webhook (TwiML)
// This is called by Twilio when the call is answered
router.post('/twilio/voice', (req, res) => {
    const leadId = req.query.leadId;
    const response = new VoiceResponse();
    const connect = response.connect();

    const stream = connect.stream({
        url: `wss://${req.headers.host.replace(/^http/, 'ws')}/`
    });

    // Pass custom parameters to the stream
    stream.parameter({
        name: 'leadId',
        value: leadId
    });

    res.type('text/xml');
    res.send(response.toString());
});

module.exports = router;
