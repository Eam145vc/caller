const twilio = require('twilio');
const db = require('../database/db');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function initiateCall(leadId) {
    // Fetch lead details
    const lead = await Promise.resolve(db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId));

    if (!lead) {
        throw new Error("Lead not found");
    }

    if (!lead.phone) {
        throw new Error("Lead has no phone number");
    }

    let publicUrl = process.env.PUBLIC_URL;
    if (!publicUrl) {
        throw new Error("PUBLIC_URL is not set");
    }
    if (!publicUrl.startsWith('http')) {
        publicUrl = `https://${publicUrl}`;
    }

    try {
        const call = await client.calls.create({
            url: `${publicUrl}/api/twilio/voice?leadId=${leadId}`,
            to: lead.phone,
            from: process.env.TWILIO_PHONE_NUMBER
        });

        console.log(`Call initiated to ${lead.phone}. SID: ${call.sid}`);

        // Log call
        await Promise.resolve(
            db.prepare('INSERT INTO calls (lead_id, twilio_call_sid, outcome) VALUES (?, ?, ?)')
                .run(leadId, call.sid, 'initiating')
        );

        return call;
    } catch (error) {
        console.error("Twilio Error:", error);
        throw error;
    }
}

module.exports = { initiateCall };
