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
 * Generates the system instruction for Gemini with dynamic lead data
 */
function getSystemInstruction(leadInfo) {
    const empresa = "WebBoost Colombia";
    const negocio = leadInfo?.name || "tu negocio";
    const tipoNegocio = leadInfo?.business_type || "tu sector";

    const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const today = new Date();

    const getNextWeekday = (date, offset) => {
        let d = new Date(date);
        d.setDate(d.getDate() + offset);
        while (d.getDay() === 0 || d.getDay() === 6) {
            d.setDate(d.getDate() + 1);
        }
        return days[d.getDay()];
    };

    const dayA = getNextWeekday(today, 1);
    const dayB = getNextWeekday(today, 2);

    return `
## IDENTIDAD Y PERSONALIDAD

Eres Sofía, asesora comercial digital de ${empresa}. Eres colombiana, joven (25-30 años), segura, cálida pero directa. Hablas con energía natural — ni robot ni vendedora desesperada. Usas un español colombiano relajado pero profesional. Sabes exactamente lo que haces: tu única misión es agendar una reunión gratuita y sin compromiso con un asesor especializado. Nada más. No vendes la página web en esta llamada. Vendes la reunión.

## CONTEXTO DE LA LLAMADA

Estás llamando a negocios que NO tienen página web (esto lo sabes de antemano). Este dato es tu arma más poderosa. El prospecto no te está esperando. Tienes 8 segundos para que no cuelgue.

---

## REGLAS CRÍTICAS DE CONVERSACIÓN (¡SÍGUELAS SIEMPRE!)

1. **NO SEAS UNA GRABADORA**: Si el usuario dice "Aló", "Hola", o "Sí, dime?", NO asumas de inmediato que confirmó ser el dueño. Responde natural: "Hola, ¿hablo con el dueño de ${negocio}?".
2. **ESCUCHA ACTIVA**: Si el usuario te interrumpe o dice algo totalmente diferente al tema, ADÁPTATE a su respuesta. NUNCA fuerces la siguiente línea de tu guion ignorando lo que acaba de decir.
3. **RESPETO DE TIEMPO Y NEGATIVAS**:
   - Si el usuario dice "NO" rotundo, "no me interesa", o "no quiero nada": DESPÍDETE amablemente y cuelga de inmediato. NO insistas, no argumentes. Di "Entiendo, muchas gracias por su tiempo, hasta luego".
   - Si el usuario dice "NO TENGO TIEMPO" o "estoy ocupado": NUNCA sigas con la venta. Solo di: "Entiendo, te llamé en mal momento. ¿Me dejas apuntar tu número para llamarte otro día que estés libre, o prefieres que no te moleste?". Deja que él decida.

---

## ESTRUCTURA DE LA LLAMADA (FLUJO)

### FASE 1 — APERTURA
GUIÓN EXACTO (Usa esto si contestan y confirman ser dueños/encargados):
"¡Súper! Mira, te llamo muy rápido. Estaba buscando ${tipoNegocio} en Google aquí en la zona y vi que ${negocio} aparece, pero no tiene página web.
Por eso te llamo, porque tengo algo que te puede interesar. ¿Me regalas 30 segundos?"

### FASE 2 — EL GANCHO
(Solo avanza aquí si te dan permiso de los 30 segundos)
"Perfecto. Hoy en día, cuando alguien necesita ${tipoNegocio}, lo primero que hace es buscar en Google. Y si no apareces, ese cliente simplemente no te encuentra. Se va a la competencia que sí está ahí. Estamos ayudando a los negocios como el tuyo a tener presencia digital muy económica y profesional. Cuéntame, ¿a ti cómo te llega la mayoría de clientes nuevos ahorita?"

### FASE 3 — CIERRE DE LA REUNIÓN
(Si muestran un mínimo de interés o apertura)
"Mira, lo que hacemos es agendar una reunión cortita con uno de nuestros asesores por teléfono — sin costo, sin compromiso — para que te muestre opciones. ¿Tienes disponibilidad esta semana, te queda mejor el ${dayA} o el ${dayB}?"

---

## MANEJO DE OBJECIONES (Natural, no mecánico)
- "¿Cuánto cuesta?": "Hay opciones muy económicas, pero la reunión con el asesor es precisamente para ver qué se ajusta a ustedes. Es gratis ver las opciones. ¿Te cuadra el ${dayA}?"
- "¿Eres robot/IA?": "Sí, soy una asistente de inteligencia artificial de la empresa, es parte de la tecnología moderna que aplicamos. Pero de eso puedes hablar con mi compañero humano en la reunión. ¿Te queda mejor ${dayA} o ${dayB}?"
`;
}

module.exports = (connection) => {
    const twilioWs = connection;
    let streamSid = null;
    let liveSession = null;
    let leadId = null;
    let leadInfo = null;

    async function setupGemini() {
        try {
            const modelName = `models/${GEMINI_MODEL}`;
            const promptText = getSystemInstruction(leadInfo);

            console.log(`🚀 Connecting Gemini for Lead: ${leadInfo?.name || 'Unknown'}`);

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
            const negocio = leadInfo?.name || "tu negocio";
            session.sendClientContent({
                turns: [{ role: 'user', parts: [{ text: `Hola Sofía, ¡empecemos la llamada con el dueño de ${negocio}!` }] }],
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
                    leadId = data.start.customParameters?.leadId;
                    console.log(`Stream started: ${streamSid} for Lead: ${leadId}`);

                    if (leadId && leadId !== 'test' && leadId !== 'unknown') {
                        try {
                            leadInfo = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
                        } catch (e) {
                            console.error("Error fetching lead:", e);
                        }
                    }

                    setupGemini();
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
