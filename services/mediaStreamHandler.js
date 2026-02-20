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

    const getNextWeekday = (date, offsetDays) => {
        let d = new Date(date);
        let added = 0;
        while (added < offsetDays) {
            d.setDate(d.getDate() + 1);
            if (d.getDay() !== 0 && d.getDay() !== 6) { // Not Sunday or Saturday
                added++;
            }
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

## ACCIONES ESPECIALES (HERRAMIENTAS DEL SISTEMA)
¡MUY IMPORTANTE! Tienes herramientas de sistema (\`tools\`) que DEBES ejecutar técnicamente cuando el usuario acepte. NO debes solo decir en voz alta "te agendé la cita", debes invocar la función de código por debajo.
1. **Agendar Cita**: Si el cliente acepta la reunión, DEBES INVOCAR LA HERRAMIENTA TÉCNICA \`book_appointment(scheduled_at)\`. (Si no usas la herramienta, la cita se perderá).
2. **Seguimiento (Follow-up)**: Si el cliente dice "llámame luego", INVOCA LA HERRAMIENTA \`schedule_follow_up(scheduled_at)\`.
3. **No Interesado**: Si rechaza rotundamente, INVOCA LA HERRAMIENTA \`mark_not_interested()\`.

## MANEJO DE RUIDO Y SILENCIO
- **Ruido**: Ignora ruidos de fondo fuertes o estática de la línea telefónica. Si escuchas un ruido fuerte y crees que te interrumpieron pero no escuchaste palabras, asume que fue ruido y sigue hablando o retoma tu idea suavemente.
- **Silencio**: Si el cliente se queda en silencio más de 5 segundos, retoma con algo como "¿Sigues por ahí?", "¿Me escuchas bien?" o repite la última pregunta amablemente.

## REGLAS CRÍTICAS DE CONVERSACIÓN
1. **Ritmo y No Silencios**: Responde inmediatamente. NUNCA te quedes callada. Si la conversación termina, despídete formalmente, pero nunca dejes silencios muertos.
2. **Respeto pero Adaptabilidad**: Si dicen que no tienen tiempo, propón amablemente llamar otro día. PERO si el cliente cambia de opinión de repente (ej. "no mentiras, cuéntame rapidito"), ADÁPTATE al instante, vuelve al ruedo con energía y retoma el guion.
3. **Brevedad**: Sé concisa. No hables más de 15 segundos seguidos. Dale espacio al cliente.
4. **Naturalidad**: Sigue el flujo base, pero reacciona como una humana brillante si te interrumpen o cambian de tema.

## FASE 1: APERTURA (Framework: Permission Opener)
*(Inicia la llamada estrictamente así)*
"Hola, ¿hablo con el dueño o encargado de ${negocio}?"
*(ESPERA LA RESPUESTA AFIRMATIVA. No sigas sin ella)*

Luego continúa exactamente así:
"Listo, mira, te llamo muy rápido. Estuve investigando tu negocio y vi que ${negocio} todavía no tiene página web, y tengo algo que puede interesarte. ¿Me regalas 30 segundos?"


## FASE 2: PROBLEMA Y AGITACIÓN (Framework: PAS + Gap Selling)
Si te da permiso, continúa adaptando esta idea a su sector y **CIERRA SIEMPRE CON UNA PREGUNTA PARA MANTENER EL CONTROL**:
"Perfecto. Hoy en día, cuando alguien necesita ${tipoNegocio} — un experto en tu área, lo que sea — lo primero que hace es buscar en Google. Y si no apareces, ese cliente simplemente no te encuentra. Se va a la competencia que sí está ahí. ¿Te ha pasado que sientes que podrías tener más clientes si te encontraran más fácil?"
*(ESPERA LA RESPUESTA)*

## FASE 3: LA SOLUCIÓN Y EL CIERRE
Luego de que responda a tu pregunta, haz la transición invitándolo a una asesoría sin compromiso:
"Totalmente de acuerdo. Nosotros ayudamos a negocios puntuales como el tuyo a que sí aparezcan ahí con una web optimizada.
¿Te queda más fácil que agendemos una breve charla de 10 minutitos con uno de nuestros especialistas para mostrarte cómo funciona, sin ningún costo ni compromiso, el ${dayA} en la tarde o prefieres el ${dayB}?"

## MANTENER EL CONTROL (REGLA DE ORO)
NUNCA termines una intervención tuya en un punto neutro. SIEMPRE debes cerrar cada frase que dices con una pregunta directa para obligar al cliente a responder y tú mantener la batuta de la llamada.
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
    let lastActivityTime = Date.now();
    let silenceInterval = null;

    async function setupGemini(customBName, customBType) {
        try {
            const modelName = `models/${GEMINI_MODEL}`;
            const promptText = getSystemInstruction(leadInfo, customBName, customBType);
            console.log(`📝 System Instruction Generated (first 100 chars): ${promptText.substring(0, 100)}...`);

            console.log(`🚀 Connecting Gemini for Lead: ${leadInfo?.name || customBName || 'Unknown'}`);

            const session = await ai.live.connect({
                model: modelName,
                config: {
                    responseModalities: ["AUDIO"],
                    systemInstruction: { parts: [{ text: promptText }] },
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } }
                    },
                    tools: [{
                        functionDeclarations: [
                            {
                                name: "book_appointment",
                                description: "Agendar una cita o asesoría con el cliente.",
                                parameters: {
                                    type: "OBJECT",
                                    properties: {
                                        scheduled_at: { type: "STRING", description: "Fecha y hora en formato YYYY-MM-DD HH:MM" }
                                    },
                                    required: ["scheduled_at"]
                                }
                            },
                            {
                                name: "schedule_follow_up",
                                description: "Programar un seguimiento para llamar al cliente más tarde.",
                                parameters: {
                                    type: "OBJECT",
                                    properties: {
                                        scheduled_at: { type: "STRING", description: "Fecha y hora sugerida de seguimiento" }
                                    },
                                    required: ["scheduled_at"]
                                }
                            },
                            {
                                name: "mark_not_interested",
                                description: "Marcar al cliente como no interesado en el servicio.",
                                parameters: { type: "OBJECT", properties: {} }
                            }
                        ]
                    }]
                },
                callbacks: {
                    onopen: () => {
                        console.log('✅ Gemini SDK Connection Open');
                    },
                    onmessage: (message) => {
                        lastActivityTime = Date.now(); // Reset on any message from AI

                        if (message.serverContent && message.serverContent.interrupted) {
                            console.log("⚠️ AI Interrupted - Clearing Twilio Queue");
                            if (streamSid && twilioWs.readyState === WebSocket.OPEN) {
                                twilioWs.send(JSON.stringify({ event: 'clear', streamSid: streamSid }));
                            }
                        }

                        // Robust tool call detection (sometimes it's at root, sometimes in serverContent)
                        const toolCall = message.toolCall || (message.serverContent && message.serverContent.toolCall);

                        if (toolCall) {
                            console.log("📥 RECEIVED TOOL CALL:", JSON.stringify(toolCall));
                            const responses = [];

                            for (const call of toolCall.functionCalls) {
                                console.log(`🛠️ AI TOOL CALL: ${call.name}`, call.args);

                                const validLeadId = (leadId && leadId !== 'test' && leadId !== 'unknown') ? leadId : null;

                                switch (call.name) {
                                    case 'book_appointment':
                                        const time = String(call.args.scheduled_at || 'Por definir');
                                        Promise.resolve(db.prepare('INSERT INTO appointments (lead_id, scheduled_at, notes) VALUES (?, ?, ?)')
                                            .run(validLeadId, time, 'Agendado por Sofía (IA via Tool)')).catch(console.error);

                                        if (validLeadId) {
                                            Promise.resolve(db.prepare("UPDATE leads SET status = 'interested' WHERE id = ?").run(validLeadId)).catch(console.error);
                                        }

                                        // Enviar confirmación inmediata de WhatsApp (si hay teléfono)
                                        if (leadInfo && leadInfo.phone) {
                                            const { sendWhatsAppMessage } = require('./whatsappService');
                                            const cliente = leadInfo.name || 'amigo';
                                            const msg = `¡Hola ${cliente}! Soy Sofía de WebBoost Colombia. Confirmo nuestra asesoría gratuita programada para el ${time}. ¡Nos vemos pronto!`;
                                            sendWhatsAppMessage(leadInfo.phone, msg).catch(console.error);
                                        }
                                        responses.push({ name: call.name, id: call.id, response: { success: true, message: "Cita agendada" } });
                                        break;

                                    case 'schedule_follow_up':
                                        const time2 = String(call.args.scheduled_at || 'Pronto');
                                        Promise.resolve(db.prepare('INSERT INTO appointments (lead_id, scheduled_at, notes, status) VALUES (?, ?, ?, ?)')
                                            .run(validLeadId, time2, 'Seguimiento (Follow-Up)', 'follow_up')).catch(console.error);

                                        if (validLeadId) {
                                            Promise.resolve(db.prepare("UPDATE leads SET status = 'contacted', notes = ? WHERE id = ?")
                                                .run(`Seguimiento el ${time2}`, validLeadId)).catch(console.error);
                                        }
                                        responses.push({ name: call.name, id: call.id, response: { success: true, message: "Seguimiento programado" } });
                                        break;

                                    case 'mark_not_interested':
                                        if (validLeadId) {
                                            Promise.resolve(db.prepare("UPDATE leads SET status = 'not_interested' WHERE id = ?").run(validLeadId)).catch(console.error);
                                        }
                                        responses.push({ name: call.name, id: call.id, response: { success: true, message: "Marcado como no interesado" } });
                                        break;
                                }
                            }

                            if (responses.length > 0) {
                                session.sendClientContent({
                                    toolResponses: { functionResponses: responses }
                                });
                            }
                        }

                        if (message.serverContent && message.serverContent.modelTurn) {
                            const parts = message.serverContent.modelTurn.parts;
                            for (const part of parts) {
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
                    onclose: (event) => {
                        console.log(`ℹ️ Gemini SDK Connection Closed. Code: ${event?.code}`);
                        if (silenceInterval) clearInterval(silenceInterval);
                    }
                }
            });

            liveSession = session;

            // Start Silence Monitor (Check every 2 seconds)
            silenceInterval = setInterval(() => {
                const idleTime = Date.now() - lastActivityTime;
                if (idleTime > 12000) { // 12 seconds of total silence
                    console.log("⏳ Silence detected, nudging AI...");
                    lastActivityTime = Date.now();
                    if (liveSession) {
                        liveSession.sendClientContent({
                            turns: [{ role: 'user', parts: [{ text: "(El cliente está en silencio, retoma la palabra amablemente para no perder la conexión)" }] }],
                            turnComplete: true
                        });
                    }
                }
            }, 2000);

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
                            leadInfo = await Promise.resolve(db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId));
                        } catch (e) {
                            console.error("Error fetching lead:", e);
                        }
                    }

                    await setupGemini(bName, bType);
                    break;

                case 'media':
                    if (liveSession) {
                        lastActivityTime = Date.now(); // Reset on user audio
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
    let energySum = 0;

    for (let i = 0; i < mulawBuffer.length; i++) {
        const sample = MU_LAW_DECODE_TABLE[mulawBuffer[i]];
        energySum += Math.abs(sample);

        pcm16[i * 2] = sample;
        // Simple linear interpolation to slightly smooth the upsample mapping
        const nextSample = (i < mulawBuffer.length - 1) ? MU_LAW_DECODE_TABLE[mulawBuffer[i + 1]] : sample;
        pcm16[i * 2 + 1] = (sample + nextSample) / 2;
    }

    const avgAmplitude = energySum / mulawBuffer.length;

    // Higher Noise Gate: If the audio is just phone line static (amplitude < 200),
    // we heavily attenuate it to prevent accidental AI interruptions.
    if (avgAmplitude < 200) {
        for (let i = 0; i < pcm16.length; i++) {
            pcm16[i] = Math.floor(pcm16[i] / 10);
        }
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
