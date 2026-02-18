const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const db = require('../database/db');
const { initiateCall } = require('../services/callEngine');
const VoiceResponse = require('twilio').twiml.VoiceResponse;

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

// Initiate a call to a lead
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

// START NEW TEST ENDPOINT
// Initiate a test call to a manual number
router.post('/calls/test', async (req, res) => {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
        return res.status(400).json({ error: "Missing phoneNumber" });
    }

    let publicUrl = process.env.PUBLIC_URL; // Using ngrok or Railway URL
    if (!publicUrl) {
        return res.status(500).json({ error: "PUBLIC_URL is not configured" });
    }
    if (!publicUrl.startsWith('http')) {
        publicUrl = `https://${publicUrl}`;
    }

    try {
        // Create a temporary "lead" in memory concept or just pass ID 0 to indicate test
        // But the webhook needs to know. Let's redirect to the same voice webhook 
        // but pass a flag or a dummy ID.

        console.log(`Initiating TEST call to ${phoneNumber}...`);

        const call = await client.calls.create({
            url: `${publicUrl}/api/twilio/voice?leadId=test`, // leadId=test signals it's a test
            to: phoneNumber,
            from: process.env.TWILIO_PHONE_NUMBER
        });

        console.log(`Test call initiated. SID: ${call.sid}`);
        res.json({ success: true, callSid: call.sid });

    } catch (error) {
        console.error("Test Call Error:", error);
        res.status(500).json({ error: error.message });
    }
});
// END NEW TEST ENDPOINT

// Twilio Voice Webhook (TwiML)
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
        value: leadId || 'unknown'
    });

    res.type('text/xml');
    res.send(response.toString());
});

module.exports = router;
