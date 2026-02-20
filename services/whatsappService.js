const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_DEFAULT_INSTANCE = process.env.EVOLUTION_DEFAULT_INSTANCE || 'WebBoost';

/**
 * Send WhatsApp text message using Evolution API
 * @param {string} to - Destination phone number with country code (e.g. 573001234567)
 * @param {string} message - Text message content
 * @param {string} [instanceName] - Optional. The name of the WhatsApp instance (for SaaS)
 */
async function sendWhatsAppMessage(to, message, instanceName = EVOLUTION_DEFAULT_INSTANCE) {
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
        console.warn("Evolution API credentials not found in environment variables. Cannot send message.");
        return;
    }

    if (!to) {
        console.error("No destination number provided for WhatsApp message.");
        return;
    }

    // Evolution API espera el número con el código de país pero normalmente sin el '+' 
    const toFormatted = to.replace('+', '');

    try {
        const url = `${EVOLUTION_API_URL}/message/sendText/${instanceName}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY
            },
            body: JSON.stringify({
                number: toFormatted,
                options: {
                    delay: 1200, // 1.2 segundos de delay artificial simulando humano escribiendo
                    presence: "composing", // Muestra "escribiendo..." en el chat del destino
                    linkPreview: false // Evita previsualizaciones que puedan ralentizar el envío masivo
                },
                textMessage: {
                    text: message
                }
            })
        });

        const responseData = await response.json();

        if (!response.ok) {
            console.error(`❌ Error en Evolution API (Instancia: ${instanceName}):`, responseData);
            return;
        }

        console.log(`✅ WhatsApp enviado a ${toFormatted} vía Instancia [${instanceName}]. ID: ${responseData.key?.id || 'Desconocido'}`);
        return responseData;
    } catch (error) {
        console.error(`❌ Error de red conectando con Evolution API en ${EVOLUTION_API_URL}:`, error);
    }
}

module.exports = {
    sendWhatsAppMessage
};
