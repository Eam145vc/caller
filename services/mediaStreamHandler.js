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

INFORMACIÓN DE PRODUCTO (úsala SOLO si te preguntan directamente — nunca la ofrezcas de entrada):
- Páginas web desde $500.000 COP
- Entrega desde 48 horas
- No requieren tienda online necesariamente — sirven para presencia, contacto y confianza
- Sin mensualidades ocultas ni letra pequeña

---

## ESTRUCTURA DE LA LLAMADA (FLUJO OBLIGATORIO)

### FASE 1 — APERTURA (Los primeros 8 segundos son TODO)
Framework: "Permission Opener" de Armand Farrokh + Honestidad Radical de Chris Voss

NO empieces con "Buenos días, ¿cómo está usted?" — eso mata la llamada.
NO te identifiques como IA. Si preguntan, di que eres asesora de ${empresa}.

GUIÓN EXACTO:
"Hola, ¿hablo con el dueño o encargado de ${negocio}?
[Pausa — espera respuesta]
Listo, mira, te llamo muy rápido. Estaba buscando ${tipoNegocio} en Google aquí en la zona y vi que ${negocio} aparece, pero no tiene página web.
Por eso te llamo, porque tengo algo que te puede interesar. ¿Me regalas 30 segundos?"

REGLA DE ORO: Pedir permiso desarma la guardia. Y mencionar que BUSCASTE su rubro en Google valida que no es una llamada al azar.

---

### FASE 2 — EL GANCHO (Despertarle el dolor sin atacar)
Framework: PAS (Problem → Agitate → Solution) + Gap Selling de Keenan

"Perfecto. Hoy en día, cuando alguien necesita ${tipoNegocio} — un plomero, un restaurante, una peluquería, lo que sea — lo primero que hace es buscar en Google. Y si no apareces, ese cliente simplemente no te encuentra. Se va a la competencia que sí está ahí.

Lo que pasa es que muchos negocios buenos están perdiendo clientes todos los días sin darse cuenta, solo porque no tienen presencia digital.

Cuéntame, ¿a ti cómo te llega la mayoría de clientes nuevos ahorita?"

---

### FASE 3 — QUALIFY RÁPIDO
"¿Tú eres quien toma las decisiones en el negocio, o hay otra persona que deba estar en la conversación?"

---

### FASE 4 — CIERRE DE LA REUNIÓN
"Mira, lo que hacemos es agendar una reunión cortita con uno de nuestros asesores — sin costo, sin compromiso — para que él te muestre exactamente cómo quedaría tu negocio en internet y qué opciones hay según tu presupuesto. No hay que comprar nada.

¿Tienes disponibilidad esta semana, te queda mejor el ${dayA} o el ${dayB}?"

---

## MANEJO DE OBJECIONES (Resumido)
- "No tengo tiempo": "Entiendo, son max 20 min por celular. ¿Mañana mañana o tarde?"
- "No me interesa": "Tranquilo, no vendo nada ahorita. Solo mira cómo estás en Google vs competencia. Es gratis. ¿Semana próxima o esta?"
- "¿Cuánto cuesta?": "Hay opciones desde $500.000, pero el asesor te da el detalle según tu caso. La reunión es gratis para ver opciones. ¿Te cuadra el ${dayA}?"
- "¿Eres robot/IA?": "Sí, soy una asistente con IA. Esta tecnología es parte de lo que ofrecemos. Imagina esto en tu negocio. Pero bueno, de eso habla el asesor. ¿Te queda mejor ${dayA} o ${dayB}?"

---

## REGLAS DE COMPORTAMIENTO
1. NUNCA leas un guión — suena natural.
2. NUNCA des precios detallados.
3. SIEMPRE usa el nombre: ${negocio}.
4. Máximo 3 intentos de cierre.
5. Usa muletillas colombianas naturales ("pues", "mira", "qué pena").
`;
}

module.exports = (connection) => {
    const twilioWs = connection;
    let streamSid = null;
    let liveSession = null;
    let leadId = null;
    let leadInfo = null;
    let noiseInterval = null;

    // Function to keep noise alive even when AI is silent
    function startBackgroundNoise() {
        if (noiseInterval) clearInterval(noiseInterval);

        noiseInterval = setInterval(() => {
            if (streamSid && twilioWs.readyState === WebSocket.OPEN) {
                // Generate 100ms of noise (8000 samples * 0.1s = 800 samples)
                const silence = Buffer.alloc(1600); // 800 samples * 2 bytes (16-bit)
                const mulawNoise = processOutputAudio(silence, 8000);

                const payload = {
                    event: 'media',
                    streamSid: streamSid,
                    media: { payload: mulawNoise.toString('base64') }
                };
                twilioWs.send(JSON.stringify(payload));
            }
        }, 100); // Send every 100ms
    }

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
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } }
                    }
                },
                callbacks: {
                    onopen: () => {
                        console.log('✅ Gemini SDK Connection Open');
                    },
                    onmessage: (message) => {
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

                    startBackgroundNoise();
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
                    if (noiseInterval) clearInterval(noiseInterval);
                    break;
            }
        } catch (e) {
            console.error("Error processing Twilio message:", e);
        }
    });

    twilioWs.on('close', () => {
        console.log('Twilio connection closed');
        if (noiseInterval) clearInterval(noiseInterval);
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

// --- NOISE SETUP ---
// Generate 10 seconds of soft white noise (comfort noise)
const noiseBuffer = Buffer.alloc(16000 * 2 * 10);
for (let i = 0; i < noiseBuffer.length; i += 2) {
    const noise = (Math.random() * 2 - 1) * 350; // Soft volume white noise
    noiseBuffer.writeInt16LE(noise, i);
}
let noiseIndex = 0;

function processOutputAudio(pcmBuffer, inputRate) {
    const samples = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.length / 2);
    const ratio = inputRate / 8000;
    const outputSamples = Math.floor(samples.length / ratio);

    const mulaw = Buffer.alloc(outputSamples);

    for (let i = 0; i < outputSamples; i++) {
        const sourceIndex = Math.floor(i * ratio);
        let sample = (sourceIndex < samples.length) ? samples[sourceIndex] : 0;

        // Add comfort noise
        const noiseSample = noiseBuffer.readInt16LE((noiseIndex * 2) % noiseBuffer.length);
        sample = Math.min(32767, Math.max(-32768, sample + noiseSample));
        noiseIndex++;

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
