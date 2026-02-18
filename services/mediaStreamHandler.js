const WebSocket = require('ws');
const { SYSTEM_MESSAGE, TOOLS } = require('./callScript');
const { createAppointment } = require('./appointmentScheduler');
const db = require('../database/db');

module.exports = (connection) => {
    // Connection to Twilio
    const twilioWs = connection;

    // State
    let streamSid = null;
    let callSid = null;
    let openAiWs = null;
    let leadId = null;

    // Connect to OpenAI Realtime API
    // Connect to OpenAI Realtime API
    const url = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01";
    console.log(`Connecting to OpenAI Realtime API...`);

    try {
        openAiWs = new WebSocket(url, {
            headers: {
                "Authorization": "Bearer " + process.env.OPENAI_API_KEY,
                "OpenAI-Beta": "realtime=v1"
            }
        });
    } catch (wsError) {
        console.error("Failed to construct OpenAI WebSocket:", wsError);
    }

    // OpenAI Event Handling
    openAiWs.on('open', () => {
        console.log('✅ Connected to OpenAI Realtime API');

        // Initialize session
        const sessionUpdate = {
            type: 'session.update',
            session: {
                turn_detection: { type: 'server_vad' },
                input_audio_format: 'g711_ulaw',
                output_audio_format: 'g711_ulaw',
                voice: 'shimmer',
                instructions: SYSTEM_MESSAGE,
                modalities: ["text", "audio"],
                temperature: 0.6,
                tools: TOOLS,
                tool_choice: "auto",
            }
        };
        openAiWs.send(JSON.stringify(sessionUpdate));
        console.log('Session update sent to OpenAI');
    });

    openAiWs.on('error', (error) => {
        console.error("❌ OpenAI WebSocket Error:", error);
    });

    openAiWs.on('close', (code, reason) => {
        console.warn(`⚠️ OpenAI WebSocket Closed. Code: ${code}, Reason: ${reason}`);
    });

    openAiWs.on('message', (data) => {
        const response = JSON.parse(data);

        // Handle Audio Output
        if (response.type === 'response.audio.delta' && response.delta) {
            const audioData = response.delta;
            const twilioPayload = {
                event: 'media',
                streamSid: streamSid,
                media: { payload: audioData }
            };
            twilioWs.send(JSON.stringify(twilioPayload));
        }

        // Handle Function Calling
        if (response.type === 'response.function_call_arguments.done') {
            const functionName = response.name;
            const args = JSON.parse(response.arguments);

            console.log(`Tool call: ${functionName}`, args);

            if (functionName === 'schedule_appointment') {
                handleScheduleAppointment(args, response.call_id);
            }
        }
    });

    // Twilio Event Handling
    twilioWs.on('message', (message) => {
        const data = JSON.parse(message);

        switch (data.event) {
            case 'start':
                streamSid = data.start.streamSid;
                callSid = data.start.callSid;
                const customParams = data.start.customParameters;
                if (customParams && customParams.leadId) {
                    leadId = customParams.leadId;
                    console.log(`Call started for Lead ID: ${leadId}`);
                }
                console.log(`Stream started: ${streamSid}`);
                break;

            case 'media':
                if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
                    const audioAppend = {
                        type: 'input_audio_buffer.append',
                        audio: data.media.payload
                    };
                    openAiWs.send(JSON.stringify(audioAppend));
                }
                break;

            case 'stop':
                console.log('Stream stopped');
                if (openAiWs) openAiWs.close();
                break;
        }
    });

    const handleScheduleAppointment = async (args, callId) => {
        let success = false;
        let message = "Failed to schedule appointment.";

        if (leadId) {
            try {
                createAppointment(leadId, args.date, args.time, args.notes);
                success = true;
                message = "Appointment scheduled successfully.";
            } catch (err) {
                console.error("Scheduling error", err);
                message = "Error scheduling appointment.";
            }
        } else {
            console.warn("No Lead ID associated with call. Cannot schedule.");
            message = "Could not identify the customer record.";
        }

        // Send output back to OpenAI
        const functionOutput = {
            type: "conversation.item.create",
            item: {
                type: "function_call_output",
                call_id: callId,
                output: JSON.stringify({ success, message })
            }
        };
        openAiWs.send(JSON.stringify(functionOutput));

        // Trigger response generation
        openAiWs.send(JSON.stringify({ type: "response.create" }));
    };
};
