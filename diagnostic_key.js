const https = require('https');

const API_KEY = "AIzaSyAuDvX82Fpo6hdou2Izee7soS7uE7wNooo";

async function testService(name, url, payload) {
    return new Promise((resolve) => {
        const postData = JSON.stringify(payload);
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(`${url}?key=${API_KEY}`, options, (res) => {
            let data = '';
            res.on('data', (f) => data += f);
            res.on('end', () => {
                console.log(`\n--- Test: ${name} ---`);
                console.log(`Status: ${res.statusCode}`);
                if (res.statusCode === 200) {
                    console.log(`✅ ${name} FUNDIONA CORRECTAMENTE.`);
                } else {
                    const err = JSON.parse(data);
                    console.log(`❌ ${name} BLOQUEADO / ERROR.`);
                    console.log(`Motivo: ${err.error?.message || 'Unknown'}`);
                    console.log(`Reason: ${err.error?.details?.[0]?.reason || 'N/A'}`);
                }
                resolve();
            });
        });
        req.on('error', (e) => {
            console.log(`❌ ${name} Error de red: ${e.message}`);
            resolve();
        });
        req.write(postData);
        req.end();
    });
}

async function run() {
    console.log("🚀 Iniciando diagnóstico de API Key...");

    // 1. Test Gemini (Generative Language)
    await testService("Gemini AI", "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent", {
        contents: [{ parts: [{ text: "Hola" }] }]
    });

    // 2. Test Text-to-Speech
    await testService("Cloud TTS", "https://texttospeech.googleapis.com/v1/text:synthesize", {
        input: { text: "Test" },
        voice: { languageCode: "es-CO" },
        audioConfig: { audioEncoding: "MP3" }
    });

    // 3. Test Speech-to-Text
    await testService("Cloud STT", "https://speech.googleapis.com/v1/speech:recognize", {
        config: { encoding: "LINEAR16", sampleRateHertz: 16000, languageCode: "es-CO" },
        audio: { content: "AAAA" } // Invalid content but 403 happens before 400
    });
}

run();
