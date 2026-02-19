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
        const initialConfig = {
            type: "conversation_initiation_client_data",
            conversation_config_override: {
                agent: {
                    prompt: {
                        first_message: "Aló, buenos días... ¿hablo con el encargado?" // Force first message here to be safe
                    }
                },
                tts: {
                    // voice_id removed to respect Agent configuration in dashboard
                    // OUTPUT FORMAT IS CRITICAL FOR TWILIO
                    // Twilio uses mulaw 8000. ElevenLabs calls this 'ulaw_8000'
                    output_format: "ulaw_8000"
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
                    // Send audio to ElevenLabs
                    // Twilio sends base64 encoded mulaw 8000hz.
                    // ElevenLabs expects base64 encoded audio.
                    const audioMessage = {
                        user_audio_chunk: data.media.payload
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
