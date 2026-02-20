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
    const { phoneNumber, businessName, businessType } = req.body;

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
        console.log(`Initiating TEST call to ${phoneNumber} for ${businessName} (${businessType})...`);

        let testLeadId = 'test';
        try {
            if (process.env.DATABASE_URL) {
                // Postgres
                const res = await db.query("INSERT INTO leads (name, phone, business_type, status) VALUES ($1, $2, $3, $4) RETURNING id", [businessName || 'Test Business', phoneNumber, businessType || 'Negocio', 'new']);
                testLeadId = res.rows[0].id;
            } else {
                // SQLite
                const info = db.prepare("INSERT INTO leads (name, phone, business_type, status) VALUES (?, ?, ?, ?)").run(businessName || 'Test Business', phoneNumber, businessType || 'Negocio', 'new');
                testLeadId = info.lastInsertRowid;
            }
            console.log("Created Test Lead ID:", testLeadId);
        } catch (e) {
            console.error("Error creating test lead:", e);
        }

        // Pass business info through query params to the webhook
        const queryParams = new URLSearchParams({
            leadId: testLeadId,
            bName: businessName || 'Mi Negocio',
            bType: businessType || 'Negocio'
        }).toString();

        const call = await client.calls.create({
            url: `${publicUrl}/api/twilio/voice?${queryParams}`,
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
    const { leadId, bName, bType } = req.query;
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

    if (bName) {
        stream.parameter({ name: 'businessName', value: bName });
    }
    if (bType) {
        stream.parameter({ name: 'businessType', value: bType });
    }

    res.type('text/xml');
    res.send(response.toString());
});

module.exports = router;
