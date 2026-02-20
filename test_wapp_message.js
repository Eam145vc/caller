const { sendWhatsAppMessage } = require('./services/whatsappService');

// Reemplaza por tu propio número (Ej en Colombia: 573001234567)
const NUMERO_DE_PRUEBA = "573XXXXXXXXX";

async function probarMensaje() {
    console.log("☎️ Iniciando prueba de WhatsApp...");

    const respuesta = await sendWhatsAppMessage(
        NUMERO_DE_PRUEBA,
        "¡Hola! Este es un mensaje de prueba de Sofía (WebBoost) y el nuevo SaaS operando en la nube de Railway con Evolution API. 🚀"
    );

    if (respuesta) {
        console.log("\n✅ Mensaje enviado exitosamente. ¡Revisa el celular receptor!");
    } else {
        console.log("\n❌ Hubo un error al enviar. Revisa los logs.");
    }
}

probarMensaje();
