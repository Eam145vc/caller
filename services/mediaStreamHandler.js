const { GoogleGenAI } = require('@google/genai');
const WebSocket = require('ws');

// GEMINI CONFIGURATION
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash-native-audio-latest";

// SYSTEM PROMPT FOR SOFIA
const SYSTEM_INSTRUCTION = `
Eres Sofía, una asesora comercial joven y relajada de "WebBoost Colombia". 
Tu objetivo es conseguir una cita de 15 minutos para mostrar una demo de página web. 

PERSONALIDAD:
- Acento: Colombiano neutro-amigable (tipo Bogotá/Medellín suave).
- Estilo: Informal, conversacional, usa muletillas naturales ("este...", "eh...", "o sea", "mira"). En cada intervención di algo muy colombiano como "pues", "mira", "qué pena".
- Velocidad: Normal. NO ROBÓTICA.

REGLAS:
1. Saludo: "Aló, buenos días... ¿qué pena, hablo con el encargado?".
2. Si te interrumpen: Calla y escucha.
3. Respuestas muy cortas (max 2 frases).
4. NO VENDAS precios, vende la curiosidad de ver la demo.
`;

const ai = new GoogleGenAI({
    apiKey: GEMINI_API_KEY,
    apiVersion: 'v1alpha'
});

module.exports = (connection) => {
    const twilioWs = connection;
    let streamSid = null;
    let liveSession = null;

    async function setupGemini() {
        try {
            const modelName = GEMINI_MODEL.startsWith('models/') ? GEMINI_MODEL : `models/${GEMINI_MODEL}`;
            console.log(`🚀 Connecting to Gemini Live with model: ${modelName}`);

            // SDK Live API implementation (Corrected for @google/genai Node.js SDK v1.42.0)
            liveSession = await ai.live.connect({
                model: modelName,
                config: {
                    responseModalities: ["AUDIO"],
                    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } }
                    }
                },
                callbacks: {
                    onopen: () => console.log('✅ Gemini SDK Connection Open'),
                    onmessage: (message) => {
                        // Log message type for debugging (ignore usageMetadata to reduce noise)
                        if (!message.usageMetadata) {
                            console.log('📬 Gemini Message Received:', Object.keys(message).filter(k => message[k]));
                        }

                        if (message.goAway) {
                            console.warn("⚠️ Gemini sent goAway:", message.goAway);
                        }

                        if (message.serverContent && message.serverContent.modelTurn) {
                            const parts = message.serverContent.modelTurn.parts;
                            for (const part of parts) {
                                if (part.inlineData && part.inlineData.mimeType.startsWith('audio/pcm')) {
                                    const pcmData = Buffer.from(part.inlineData.data, 'base64');
                                    const mulawBuffer = processOutputAudio(pcmData);

                                    const payload = {
                                        event: 'media',
                                        streamSid: streamSid,
                                        media: { payload: mulawBuffer.toString('base64') }
                                    };
                                    if (streamSid && twilioWs.readyState === WebSocket.OPEN) {
                                        twilioWs.send(JSON.stringify(payload));
                                    }
                                }
                            }
                        }
                    },
                    onerror: (err) => console.error("❌ Gemini SDK Error Callback:", err),
                    onclose: (event) => {
                        console.log(`ℹ️ Gemini SDK Connection Closed. Code: ${event?.code}, Reason: ${event?.reason}`);
                    }
                }
            });

            console.log('✅ SDK Gemini Live Connected');

            // Greet first - Using sendClientContent for text/turns
            liveSession.sendClientContent({
                turns: [{ role: 'user', parts: [{ text: "Hola Sofía, ¡empecemos la llamada!" }] }],
                turnComplete: true
            });

        } catch (err) {
            console.error("❌ Gemini SDK Connection Error (catch):", err);
        }
    }

    setupGemini();

    // Twilio Event Handling
    twilioWs.on('message', (message) => {
        const data = JSON.parse(message);

        switch (data.event) {
            case 'start':
                streamSid = data.start.streamSid;
                console.log(`Stream started: ${streamSid}`);
                break;

            case 'media':
                if (liveSession) {
                    const mulaw = Buffer.from(data.media.payload, 'base64');
                    const pcm16k = processInputAudio(mulaw);

                    // Sending real-time audio input using sendRealtimeInput
                    liveSession.sendRealtimeInput({
                        audio: {
                            mimeType: "audio/pcm;rate=16000",
                            data: pcm16k.toString('base64')
                        }
                    });
                }
                break;

            case 'stop':
                console.log('Stream stopped');
                break;
        }
    });
};

// --- AUDIO UTILS (Optimized) ---

const MU_LAW_DECODE_TABLE = [
    -32124, -31100, -30076, -29052, -28028, -27004, -25980, -24956, -23932, -22908, -21884, -20860, -19836, -18812, -17788, -16764, -15996, -15484, -14972, -14460, -13948, -13436, -12924, -12412, -11900, -11388, -10876, -10364, -9852, -9340, -8828, -8316, -7932, -7676, -7420, -7164, -6908, -6652, -6396, -6140, -5884, -5628, -5372, -5116, -4860, -4604, -4348, -4092, -3900, -3772, -3644, -3516, -3388, -3260, -3132, -3004, -2876, -2748, -2620, -2492, -2364, -2236, -2108, -1980, -1884, -1820, -1756, -1692, -1628, -1564, -1500, -1436, -1372, -1308, -1244, -1180, -1116, -1052, -988, -924, -876, -844, -812, -780, -748, -716, -684, -652, -620, -588, -556, -524, -492, -460, -428, -396, -372, -356, -340, -324, -308, -292, -276, -260, -244, -228, -212, -196, -180, -164, -148, -132, -120, -112, -104, -96, -88, -80, -72, -64, -56, -48, -40, -32, -24, -16, -8, 0,
    32124, 31100, 30076, 29052, 28028, 27004, 25980, 24956, 23932, 22908, 21884, 20860, 19836, 18812, 17788, 16764, 15996, 15484, 14972, 14460, 13948, 13436, 12924, 12412, 11900, 11388, 10876, 10364, 9852, 9340, 8828, 8316, 7932, 7676, 7420, 7164, 6908, 6652, 6396, 6140, 5884, 5628, 5372, 5116, 4860, 4604, 4348, 4092, 3900, 3772, 3644, 3516, 3388, 3260, 3132, 3004, 2876, 2748, 2620, 2492, 2364, 2236, 2108, 1980, 1884, 1820, 1756, 1692, 1628, 1564, 1500, 1436, 1372, 1308, 1244, 1180, 1116, 1052, 988, 924, 876, 844, 812, 780, 748, 716, 684, 652, 620, 588, 556, 524, 492, 460, 428, 396, 372, 356, 340, 324, 308, 292, 276, 260, 244, 228, 212, 196, 180, 164, 148, 132, 120, 112, 104, 96, 88, 80, 72, 64, 56, 48, 40, 32, 24, 16, 8, 0
];

function processInputAudio(mulawBuffer) {
    const pcm16 = new Int16Array(mulawBuffer.length * 2);
    for (let i = 0; i < mulawBuffer.length; i++) {
        const sample = MU_LAW_DECODE_TABLE[mulawBuffer[i]];
        pcm16[i * 2] = sample;
        pcm16[i * 2 + 1] = sample; // Upsample 8k -> 16k
    }
    return Buffer.from(pcm16.buffer);
}

function processOutputAudio(pcm24k) {
    const pcm16 = new Int16Array(pcm24k.buffer, pcm24k.byteOffset, pcm24k.length / 2);
    const mulaw = Buffer.alloc(Math.floor(pcm16.length / 3));
    for (let i = 0, j = 0; i < pcm16.length; i += 3, j++) {
        mulaw[j] = linearToMuLaw(pcm16[i]);
    }
    return mulaw;
}

function linearToMuLaw(pcm_val) {
    const BIAS = 0x84;
    const MAX = 32635;
    let mask;
    if (pcm_val < 0) { pcm_val = BIAS - pcm_val; mask = 0x7F; }
    else { pcm_val += BIAS; mask = 0xFF; }
    if (pcm_val > MAX) pcm_val = MAX;
    const seg = (pcm_val < 0x100) ? 0 : (pcm_val < 0x200) ? 1 : (pcm_val < 0x400) ? 2 : (pcm_val < 0x800) ? 3 : (pcm_val < 0x1000) ? 4 : (pcm_val < 0x2000) ? 5 : (pcm_val < 0x4000) ? 6 : 7;
    let uval = (seg << 4) | ((pcm_val >> (seg + 3)) & 0xF);
    return ~(uval | mask);
}
