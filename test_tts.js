const https = require('https');
const fs = require('fs');

const API_KEY = "AIzaSyAuDvX82Fpo6hdou2Izee7soS7uE7wNooo";

// Data for Google TTS
const postData = JSON.stringify({
    input: { text: "Hola, esto es una prueba de sonido para WebBoost Colombia." },
    voice: { languageCode: "es-CO", name: "es-CO-Neural2-A" }, // Colombian Neural Voice
    audioConfig: { audioEncoding: "MP3" }
});

const options = {
    hostname: 'texttospeech.googleapis.com',
    path: `/v1/text:synthesize?key=${API_KEY}`,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
    }
};

const req = https.request(options, (res) => {
    let data = '';
    console.log(`Status Code: ${res.statusCode}`);

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        if (res.statusCode === 200) {
            const response = JSON.parse(data);
            if (response.audioContent) {
                console.log("✅ TTS Success! Audio content received.");
            } else {
                console.log("❌ TTS Response missing audioContent:", response);
            }
        } else {
            console.error("❌ TTS Error Body:", data);
        }
    });
});

req.on('error', (e) => {
    console.error(`Request error: ${e.message}`);
});

req.write(postData);
req.end();
