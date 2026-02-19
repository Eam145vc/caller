const WebSocket = require('ws');
const { createAppointment } = require('./appointmentScheduler');
const db = require('../database/db');

// ELEVENLABS CONFIGURATION
const ELEVENLABS_AGENT_ID = "agent_7201khsj2mbneaytqs6q2q78d39g"; // Added agent_ prefix
// Make sure to add ELEVENLABS_API_KEY to your .env file!

module.exports = (connection) => {
    const twilioWs = connection;
    let streamSid = null;
    let elevenLabsWs = null;
    let callSid = null;
    let leadId = null;

    // Check for API Key
    if (!process.env.ELEVENLABS_API_KEY) {
        console.error("❌ MISSING ELEVENLABS_API_KEY in .env file");
        console.error("Please add: ELEVENLABS_API_KEY=your_api_key_here");
        return;
    }

    // Connect to ElevenLabs Conversational AI WebSocket
    // Use query parameter for auth to ensure it passes through
    const url = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${ELEVENLABS_AGENT_ID}&xi-api-key=${process.env.ELEVENLABS_API_KEY}`;
    console.log('Connecting to ElevenLabs Conversational AI...');

    try {
        elevenLabsWs = new WebSocket(url);
    } catch (err) {
        console.error("Failed to connect to ElevenLabs:", err);
        return;
    }

    // ElevenLabs Event Handling
    elevenLabsWs.on('open', () => {
        console.log('✅ Connected to ElevenLabs');

        // Initial Configuration to match Twilio's Audio Format (mulaw 8000Hz)
        // We tell ElevenLabs that we want output in ulaw_8000 so we don't need to transcode
        // Explicitly setting parameters as per documentation
        const initialConfig = {
            type: "conversation_initiation_client_data",
            conversation_config_override: {
                agent: {
                    prompt: {
                        first_message: "Aló, buenos días... ¿hablo con el encargado?"
                    }
                },
                tts: {
                    // voice_id removed to respect Agent configuration in dashboard
                    output_format: "ulaw_8000" // This is the correct enum
                }
            }
        };
        elevenLabsWs.send(JSON.stringify(initialConfig));
    });

    elevenLabsWs.on('message', async (data) => {
        const message = JSON.parse(data);

        switch (message.type) {
            case 'audio':
                // Incoming audio from ElevenLabs -> Send to Twilio
                if (streamSid) {
                    // ElevenLabs sends base64 audio.
                    // If it's PCM 16k, it might sound fast/slow/static on Twilio (8k mulaw).
                    // WE HIGHLY RECOMMEND verifying Agent settings are "8000Hz".
                    const audioData = message.audio_event?.audio_base_64;
                    if (audioData) {
                        const twilioPayload = {
                            event: 'media',
                            streamSid: streamSid,
                            media: { payload: audioData }
                        };
                        twilioWs.send(JSON.stringify(twilioPayload));
                    }
                }
                break;

            case 'interruption':
                // ElevenLabs detected user interruption -> Valid for handling logic (clear buffer)
                if (streamSid) {
                    twilioWs.send(JSON.stringify({
                        event: 'clear',
                        streamSid: streamSid
                    }));
                }
                break;

            case 'client_tool_call':
                // Handle Tool Calls (e.g. schedule_appointment)
                const toolCall = message.tool_call;
                console.log(`🛠️ Tool Call Request: ${toolCall.name}`);

                if (toolCall.name === 'schedule_appointment') {
                    const args = toolCall.arguments;
                    let success = false;
                    let responseMsg = "Failed to schedule.";

                    try {
                        if (leadId) {
                            await createAppointment(leadId, args.date, args.time, args.notes);
                            success = true;
                            responseMsg = "Appointment scheduled successfully.";
                        } else {
                            responseMsg = "Test call - appointment noted.";
                            success = true;
                        }
                    } catch (err) {
                        console.error("Tool execution error:", err);
                    }

                    const toolResult = {
                        type: "client_tool_result",
                        tool_result: {
                            tool_call_id: toolCall.tool_call_id,
                            result: responseMsg
                        }
                    };
                    elevenLabsWs.send(JSON.stringify(toolResult));
                }
                break;

            case 'ping':
                // Keep alive if needed
                if (message.ping_event?.event_id) {
                    elevenLabsWs.send(JSON.stringify({
                        type: "pong",
                        event_id: message.ping_event.event_id
                    }));
                }
                break;
        }
    });

    elevenLabsWs.on('error', (error) => {
        console.error("❌ ElevenLabs WebSocket Error:", error);
    });

    elevenLabsWs.on('close', (code, reason) => {
        console.warn(`⚠️ ElevenLabs WebSocket Closed. Code: ${code}, Reason: ${reason ? reason.toString() : 'No reason provided'}`);
    });

    // Twilio Event Handling
    twilioWs.on('message', (message) => {
        const data = JSON.parse(message);

        switch (data.event) {
            case 'start':
                streamSid = data.start.streamSid;
                callSid = data.start.callSid;
                console.log(`Stream started: ${streamSid}`);
                break;

            case 'media':
                if (elevenLabsWs && elevenLabsWs.readyState === WebSocket.OPEN) {
                    // Twilio sends mulaw 8000Hz base64.
                    // ElevenLabs expects base64, usually PCM.
                    // We must decode mulaw -> PCM16 linear (base64) for ElevenLabs to hear us.
                    const mulawBuffer = Buffer.from(data.media.payload, 'base64');
                    const pcmBuffer = mulawToPcm(mulawBuffer);
                    const pcmBase64 = pcmBuffer.toString('base64');

                    const audioMessage = {
                        user_audio_chunk: pcmBase64
                    };
                    elevenLabsWs.send(JSON.stringify(audioMessage));
                }
                break;

            case 'stop':
                console.log('Stream stopped');
                if (elevenLabsWs) elevenLabsWs.close();
                break;
        }
    });
};

// --- UTILITY: Mu-Law to PCM16 Decoder ---
// Simple lookup table approach for speed
const MU_LAW_TABLE = [
    -32124, -31100, -30076, -29052, -28028, -27004, -25980, -24956,
    -23932, -22908, -21884, -20860, -19836, -18812, -17788, -16764,
    -15996, -15484, -14972, -14460, -13948, -13436, -12924, -12412,
    -11900, -11388, -10876, -10364, -9852, -9340, -8828, -8316,
    -7932, -7676, -7420, -7164, -6908, -6652, -6396, -6140,
    -5884, -5628, -5372, -5116, -4860, -4604, -4348, -4092,
    -3900, -3772, -3644, -3516, -3388, -3260, -3132, -3004,
    -2876, -2748, -2620, -2492, -2364, -2236, -2108, -1980,
    -1884, -1820, -1756, -1692, -1628, -1564, -1500, -1436,
    -1372, -1308, -1244, -1180, -1116, -1052, -988, -924,
    -876, -844, -812, -780, -748, -716, -684, -652,
    -620, -588, -556, -524, -492, -460, -428, -396,
    -372, -356, -340, -324, -308, -292, -276, -260,
    -244, -228, -212, -196, -180, -164, -148, -132,
    -120, -112, -104, -96, -88, -80, -72, -64,
    -56, -48, -40, -32, -24, -16, -8, 0,
    32124, 31100, 30076, 29052, 28028, 27004, 25980, 24956,
    23932, 22908, 21884, 20860, 19836, 18812, 17788, 16764,
    15996, 15484, 14972, 14460, 13948, 13436, 12924, 12412,
    11900, 11388, 10876, 10364, 9852, 9340, 8828, 8316,
    7932, 7676, 7420, 7164, 6908, 6652, 6396, 6140,
    5884, 5628, 5372, 5116, 4860, 4604, 4348, 4092,
    3900, 3772, 3644, 3516, 3388, 3260, 3132, 3004,
    2876, 2748, 2620, 2492, 2364, 2236, 2108, 1980,
    1884, 1820, 1756, 1692, 1628, 1564, 1500, 1436,
    1372, 1308, 1244, 1180, 1116, 1052, 988, 924,
    876, 844, 812, 780, 748, 716, 684, 652,
    620, 588, 556, 524, 492, 460, 428, 396,
    372, 356, 340, 324, 308, 292, 276, 260,
    244, 228, 212, 196, 180, 164, 148, 132,
    120, 112, 104, 96, 88, 80, 72, 64,
    56, 48, 40, 32, 24, 16, 8, 0
];

function mulawToPcm(buffer) {
    const pcmBuffer = Buffer.alloc(buffer.length * 2);
    for (let i = 0; i < buffer.length; i++) {
        const sample = MU_LAW_TABLE[buffer[i]];
        pcmBuffer.writeInt16LE(sample, i * 2);
    }
    return pcmBuffer;
}
