const { GoogleGenAI } = require('@google/genai');
const WebSocket = require('ws');
const db = require('../database/db');

// GEMINI CONFIGURATION
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025";

const ai = new GoogleGenAI({
    apiKey: GEMINI_API_KEY,
    apiVersion: 'v1alpha'
});

/**
 * Generates the system instruction for Gemini with dynamic lead data and real-time awareness
 */
function getSystemInstruction(leadInfo, bName, bType) {
    const empresa = "WebBoost Colombia";
    const negocio = bName || leadInfo?.name || "tu negocio";
    const tipoNegocio = bType || leadInfo?.business_type || "tu sector";

    const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

    const now = new Date();
    // Adjust to Colombia time (UTC-5) if server is in another region
    const coNow = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) - (5 * 3600000));

    const dayName = days[coNow.getDay()];
    const dateNum = coNow.getDate();
    const monthName = months[coNow.getMonth()];
    const year = coNow.getFullYear();
    const timeStr = coNow.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });

    const getNextWeekday = (date, offset) => {
        let d = new Date(date);
        d.setDate(d.getDate() + offset);
        while (d.getDay() === 0 || d.getDay() === 6) { // Skip weekends
            d.setDate(d.getDate() + 1);
        }
        return days[d.getDay()];
    };

    const dayA = getNextWeekday(coNow, 1);
    const dayB = getNextWeekday(coNow, 2);

    return `
## IDENTIDAD Y PERSONALIDAD
Eres Sofía, una experta asesora comercial de ${empresa}. Eres colombiana, joven, brillante y muy carismática. 
Hoy es **${dayName}, ${dateNum} de ${monthName} de ${year}**, y son las **${timeStr}** en Colombia.
Tu misión es agendar una asesoría gratuita de 15 minutos para mostrarle al dueño de ${negocio} cómo aparecer en Google.

## REGLAS DE CONTEXTO
- Estás llamando a ${negocio}, un negocio del sector: ${tipoNegocio}.
- No tienen página web y están perdiendo clientes frente a la competencia que sí aparece en Google.
- Si el cliente acepta una cita, propón el **${dayA}** o el **${dayB}**.

## ACCIONES ESPECIALES (IMPORTANTE)
Si logras un acuerdo, debes incluir al final de tu respuesta (en texto, aunque no lo digas) uno de estos tags para que el sistema lo registre:
1. **Agendar Cita**: Si el cliente acepta la reunión, usa el tag: \`[BOOK_APPOINTMENT: YYYY-MM-DD HH:MM]\`. (Ejemplo: [BOOK_APPOINTMENT: 2026-02-21 15:30])
2. **Seguimiento (Follow-up)**: Si el cliente dice "llámame luego", usa el tag: \`[FOLLOW_UP: YYYY-MM-DD HH:MM]\`.
3. **No Interesado**: Si dice que no quiere nada, usa: \`[NOT_INTERESTED]\`.

## REGLAS CRÍTICAS DE CONVERSACIÓN
1. **Escucha Activa**: Si dicen "Aló" o "¿Quién habla?", responde: "Hola, ¿hablo con el encargado de ${negocio}?". No sueltes el discurso hasta confirmar.
2. **Respeto Absoluto**: Si dicen que no tienen tiempo, NO insistas con el guion. Di: "Entiendo perfectamente, te llamó en mal momento. ¿Te parece bien si te contacto el ${dayA} en la tarde o prefieres otro momento?".
3. **Brevedad**: Sé concisa. No hables más de 15-20 segundos seguidos. Dale espacio al cliente para hablar.

## FLUJO DE LLAMADA
- **Apertura**: "Hola, buscaba ${tipoNegocio} en Google y vi que ${negocio} no tiene web. ¿Tienes 30 segundos?"
- **El Dolor**: "Sin web, los clientes se van con los que sí aparecen primero. Queremos ayudarte a cambiar eso."
- **Cierre**: "¿Te queda mejor una breve charla el ${dayA} o el ${dayB}?"
`;
}

module.exports = (connection) => {
    const twilioWs = connection;
    let streamSid = null;
    let liveSession = null;
    let leadId = null;
    let leadInfo = null;
    let bName = null;
    let bType = null;

    async function setupGemini(customBName, customBType) {
        try {
            const modelName = `models/${GEMINI_MODEL}`;
            const promptText = getSystemInstruction(leadInfo, customBName, customBType);

            console.log(`🚀 Connecting Gemini for Lead: ${leadInfo?.name || customBName || 'Unknown'}`);

            const session = await ai.live.connect({
                model: modelName,
                config: {
                    responseModalities: ["AUDIO"],
                    systemInstruction: { parts: [{ text: promptText }] },
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } }
                    }
                },
                callbacks: {
                    onopen: () => {
                        console.log('✅ Gemini SDK Connection Open');
                    },
                    onmessage: (message) => {
                        if (message.serverContent && message.serverContent.interrupted) {
                            console.log("⚠️ AI Interrupted - Clearing Twilio Queue");
                            if (streamSid && twilioWs.readyState === WebSocket.OPEN) {
                                twilioWs.send(JSON.stringify({ event: 'clear', streamSid: streamSid }));
                            }
                        }
                        if (message.serverContent && message.serverContent.modelTurn) {
                            const parts = message.serverContent.modelTurn.parts;
                            for (const part of parts) {
                                if (part.text) {
                                    // Process internal tags for DB updates
                                    console.log("📝 AI Text Part:", part.text);

                                    // 1. Appointment Booking
                                    const bookMatch = part.text.match(/\[BOOK_APPOINTMENT:\s*([\d\-\s:]+)\]/);
                                    if (bookMatch) {
                                        const dateStr = bookMatch[1].trim();
                                        console.log(`📅 ACTION: Booking appointment at ${dateStr}`);
                                        if (leadId && leadId !== 'test') {
                                            db.prepare('INSERT INTO appointments (lead_id, scheduled_at, notes) VALUES (?, ?, ?)')
                                                .run(leadId, dateStr, 'Agendado por Sofía (IA)');
                                            db.prepare("UPDATE leads SET status = 'interested' WHERE id = ?").run(leadId);
                                        }
                                    }

                                    // 2. Follow up
                                    const followMatch = part.text.match(/\[FOLLOW_UP:\s*([\d\-\s:]+)\]/);
                                    if (followMatch) {
                                        console.log(`📞 ACTION: Scheduled Follow-up at ${followMatch[1]}`);
                                        if (leadId && leadId !== 'test') {
                                            db.prepare("UPDATE leads SET status = 'contacted', notes = ? WHERE id = ?")
                                                .run(`Seguimiento el ${followMatch[1]}`, leadId);
                                        }
                                    }

                                    // 3. Not Interested
                                    if (part.text.includes('[NOT_INTERESTED]')) {
                                        console.log("❌ ACTION: Lead marked Not Interested");
                                        if (leadId && leadId !== 'test') {
                                            db.prepare("UPDATE leads SET status = 'not_interested' WHERE id = ?").run(leadId);
                                        }
                                    }
                                }

                                if (part.inlineData && part.inlineData.mimeType.startsWith('audio/pcm')) {
                                    const mimeType = part.inlineData.mimeType;
                                    const pcmData = Buffer.from(part.inlineData.data, 'base64');
                                    const rateMatch = mimeType.match(/rate=(\d+)/);
                                    const rate = rateMatch ? parseInt(rateMatch[1]) : 24000;

                                    const mulawBuffer = processOutputAudio(pcmData, rate);

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
                    onclose: (event) => console.log(`ℹ️ Gemini SDK Connection Closed. Code: ${event?.code}`)
                }
            });

            liveSession = session;

            console.log('✅ SDK Gemini Live Connected');
            const target = customBName || leadInfo?.name || "tu negocio";
            session.sendClientContent({
                turns: [{ role: 'user', parts: [{ text: `Hola Sofía, ¡empecemos la llamada con el dueño de ${target}!` }] }],
                turnComplete: true
            });

        } catch (err) {
            console.error("❌ Gemini SDK Connection Error:", err);
        }
    }

    // Twilio Event Handling
    twilioWs.on('message', async (message) => {
        try {
            const data = JSON.parse(message);

            switch (data.event) {
                case 'start':
                    streamSid = data.start.streamSid;
                    const params = data.start.customParameters || {};
                    leadId = params.leadId;
                    bName = params.businessName;
                    bType = params.businessType;

                    console.log(`Stream started: ${streamSid} for Lead: ${leadId} (${bName})`);

                    if (leadId && leadId !== 'test' && leadId !== 'unknown') {
                        try {
                            leadInfo = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
                        } catch (e) {
                            console.error("Error fetching lead:", e);
                        }
                    }

                    setupGemini(bName, bType);
                    break;

                case 'media':
                    if (liveSession) {
                        const mulawIn = Buffer.from(data.media.payload, 'base64');
                        const pcm16k = processInputAudio(mulawIn);
                        liveSession.sendRealtimeInput({
                            audio: { mimeType: "audio/pcm;rate=16000", data: pcm16k.toString('base64') }
                        });
                    }
                    break;

                case 'stop':
                    console.log('Stream stopped');
                    break;
            }
        } catch (e) {
            console.error("Error processing Twilio message:", e);
        }
    });

    twilioWs.on('close', () => {
        console.log('Twilio connection closed');
    });
};

// --- AUDIO UTILS ---

const MU_LAW_DECODE_TABLE = [
    -32124, -31100, -30076, -29052, -28028, -27004, -25980, -24956, -23932, -22908, -21884, -20860, -19836, -18812, -17788, -16764, -15996, -15484, -14972, -14460, -13948, -13436, -12924, -12412, -11900, -11388, -10876, -10364, -9852, -9340, -8828, -8316, -7932, -7676, -7420, -7164, -6908, -6652, -6396, -6140, -5884, -5628, -5372, -5116, -4860, -4604, -4348, -4092, -3900, -3772, -3644, -3516, -3388, -3260, -3132, -3004, -2876, -2748, -2620, -2492, -2364, -2236, -2108, -1980, -1884, -1820, -1756, -1692, -1628, -1564, -1500, -1436, -1372, -1308, -1244, -1180, -1116, -1052, -988, -924, -876, -844, -812, -780, -748, -716, -684, -652, -620, -588, -556, -524, -492, -460, -428, -396, -372, -356, -340, -324, -308, -292, -276, -260, -244, -228, -212, -196, -180, -164, -148, -132, -120, -112, -104, -96, -88, -80, -72, -64, -56, -48, -40, -32, -24, -16, -8, 0,
    32124, 31100, 30076, 29052, 28028, 27004, 25980, 24956, 23932, 22908, 21884, 20860, 19836, 18812, 17788, 16764, 15996, 15484, 14972, 14460, 13948, 13436, 12924, 12412, 11900, 11388, 10876, 10364, 9852, 9340, 8828, 8316, 7932, 7676, 7420, 7164, 6908, 6652, 6396, 6140, 5884, 5628, 5372, 5116, 4860, 4604, 4348, 4092, 3900, 3772, 3644, 3516, 3388, 3260, 3132, 3004, 2876, 2748, 2620, 2492, 2364, 2236, 2108, 1980, 1884, 1820, 1756, 1692, 1628, 1564, 1500, 1436, 1372, 1308, 1244, 1180, 1116, 1052, 988, 924, 876, 844, 812, 780, 748, 716, 684, 652, 620, 588, 556, 524, 492, 460, 428, 396, 372, 356, 340, 324, 308, 292, 276, 260, 244, 228, 212, 196, 180, 164, 148, 132, 120, 112, 104, 96, 88, 80, 72, 64, 56, 48, 40, 32, 24, 16, 8, 0
];

function processInputAudio(mulawBuffer) {
    const pcm16 = new Int16Array(mulawBuffer.length * 2);
    for (let i = 0; i < mulawBuffer.length; i++) {
        const sample = MU_LAW_DECODE_TABLE[mulawBuffer[i]];
        pcm16[i * 2] = sample;
        pcm16[i * 2 + 1] = sample;
    }
    return Buffer.from(pcm16.buffer);
}

function processOutputAudio(pcmBuffer, inputRate) {
    const samples = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.length / 2);
    const ratio = inputRate / 8000;
    const outputSamples = Math.floor(samples.length / ratio);

    const mulaw = Buffer.alloc(outputSamples);

    for (let i = 0; i < outputSamples; i++) {
        const sourceIndex = Math.floor(i * ratio);
        let sample = (sourceIndex < samples.length) ? samples[sourceIndex] : 0;
        mulaw[i] = linearToMuLaw(sample);
    }
    return mulaw;
}

function linearToMuLaw(linear) {
    const BIAS = 0x84;
    const CLIP = 32635;
    let sign = (linear < 0) ? 0x80 : 0x00;
    if (linear < 0) linear = -linear;
    if (linear > CLIP) linear = CLIP;
    linear = linear + BIAS;
    let exponent, position;
    if (linear >= 0x4000) { exponent = 7; position = 14; }
    else if (linear >= 0x2000) { exponent = 6; position = 13; }
    else if (linear >= 0x1000) { exponent = 5; position = 12; }
    else if (linear >= 0x0800) { exponent = 4; position = 11; }
    else if (linear >= 0x0400) { exponent = 3; position = 10; }
    else if (linear >= 0x0200) { exponent = 2; position = 9; }
    else if (linear >= 0x0100) { exponent = 1; position = 8; }
    else { exponent = 0; position = 7; }
    let mantissa = (linear >> (position - 4)) & 0x0F;
    return ~(sign | (exponent << 4) | mantissa);
}
