const fs = require('fs');

async function waitForQR() {
    const baseUrl = "https://evolution-api-production-7e34.up.railway.app";
    const apikey = "caller930120*";
    const instanceName = "wappi";

    console.log("🧹 1. Eliminando instancia (por si acaso)...");
    await fetch(`${baseUrl}/instance/logout/${instanceName}`, { method: 'DELETE', headers: { 'apikey': apikey } });
    await fetch(`${baseUrl}/instance/delete/${instanceName}`, { method: 'DELETE', headers: { 'apikey': apikey } });
    await new Promise(r => setTimeout(r, 4000));

    console.log("🚀 2. Creando instancia y solicitando WhatsApp Web Version nueva...");
    await fetch(`${baseUrl}/instance/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': apikey },
        body: JSON.stringify({ instanceName: instanceName, qrcode: true, integration: "WHATSAPP-BAILEYS" })
    });

    console.log("⌛ 3. Esperando que Evolution genere el QR (polling)...");

    // Polling cada 3 segundos
    for (let i = 1; i <= 20; i++) {
        await new Promise(r => setTimeout(r, 3000));
        process.stdout.write(` Intento ${i}... `);

        try {
            let res = await fetch(`${baseUrl}/instance/connect/${instanceName}`, { headers: { 'apikey': apikey } });
            let data = await res.json();

            let base64 = data.base64 || (data.qrcode && data.qrcode.base64);

            if (base64 && base64.length > 50) {
                console.log("\n✅ ¡QR OBTENIDO CON ÉXITO!");
                const htmlContent = `<!DOCTYPE html><html lang="es"><body style="text-align: center; margin-top: 50px; background: #f0f2f5;">
                    <div style="background: white; padding: 40px; border-radius: 10px; display: inline-block; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                        <h2 style="color: #075e54;">Escanea este QR con tu WhatsApp</h2>
                        <img src="${base64}" alt="QR Code" width="350" style="border: 10px solid white; border-radius: 5px;"/>
                        <p><small>Abre esto en el celular o pc -> WhatsApp -> Dispositivos Vinculados</small></p>
                    </div></body></html>`;
                fs.writeFileSync('c:\\Users\\DISCORD\\Desktop\\caller\\qr.html', htmlContent);
                console.log("👉 Por favor abre este archivo: c:\\Users\\DISCORD\\Desktop\\caller\\qr.html");
                return;
            } else if (data.instance && data.instance.state === "open") {
                console.log("\n✅ YA ESTÁS CONECTADO. ¡WhatsApp vinculado exitosamente!");
                return;
            }
        } catch (e) { /* ignore */ }
    }
    console.log("\n❌ Tiempo agotado resolviendo QR.");
}

waitForQR();
