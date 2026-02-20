const db = require('../database/db');
const { sendWhatsAppMessage } = require('./whatsappService');

// Un Set en memoria para recordar a qué citas ya les enviamos el recordatorio.
// En producción (con reinicios), es mejor tener una columna 'reminder_sent' en la BD,
// pero esto funciona perfectamente mientras la app esté encendida.
const sentReminders = new Set();

function startReminderJob() {
    console.log("⏰ Iniciando scheduler de recordatorios por WhatsApp... (Job cada 1 min)");

    setInterval(async () => {
        try {
            // Buscamos todas las citas que están agendadas
            const appointments = await Promise.resolve(db.prepare(`
                SELECT a.id, a.scheduled_at, a.notes, l.phone, l.name, l.business_type 
                FROM appointments a
                JOIN leads l ON a.lead_id = l.id
                WHERE a.status = 'scheduled'
            `).all());

            const now = new Date();
            // 2 horas en el futuro
            const twoHoursFromNow = new Date(now.getTime() + (2 * 60 * 60 * 1000));
            // Creamos una pequeña ventana de tiempo (ej. 5 min) por si el cron entra levemente tarde
            const windowEnd = new Date(twoHoursFromNow.getTime() + (5 * 60 * 1000));

            for (const apt of appointments) {
                // Parseamos la fecha (Ej formato esperado por la IA: "yyyy-mm-dd hh:mm")
                const scheduledDate = new Date(apt.scheduled_at);

                if (isNaN(scheduledDate.getTime())) continue;

                // Verificamos si la cita ocurre exactamente entre 2h y 2h+5min desde ahora
                if (scheduledDate >= twoHoursFromNow && scheduledDate <= windowEnd) {
                    // Si no hemos enviado aún el recordatorio
                    if (!sentReminders.has(apt.id)) {
                        console.log(`⏳ Enviando recordatorio de 2-horas para la cita ${apt.id} (${apt.name})`);

                        const cliente = apt.name || 'amigo';
                        const message = `¡Hola ${cliente}! Soy Sofía de WebBoost Colombia. Te escribo para recordarte que en 2 horitas tenemos nuestra asesoría para mostrarte cómo conseguir más clientes por Google. ¡Te esperamos!`;

                        await sendWhatsAppMessage(apt.phone, message);

                        // Lo guardamos en el Set para no volver a llamarlo en el siguiente minuto
                        sentReminders.add(apt.id);
                    }
                }
            }
        } catch (error) {
            console.error("❌ Error en el job de recordatorios WPP:", error);
        }
    }, 60 * 1000); // 1 minuto (60,000 milisegundos)
}

module.exports = { startReminderJob };
