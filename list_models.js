const https = require('https');

const API_KEY = "AIzaSyAuDvX82Fpo6hdou2Izee7soS7uE7wNooo";
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        try {
            const response = JSON.parse(data);
            if (response.models) {
                console.log("✅ Available Models:");
                response.models.forEach(m => {
                    // Filter for models that might support audio/speech
                    if (m.name.includes("flash") || m.name.includes("audio") || m.name.includes("exp")) {
                        console.log(`- ${m.name} (Methods: ${m.supportedGenerationMethods})`);
                    }
                });
            } else {
                console.error("❌ No models found or error:", response);
            }
        } catch (e) {
            console.error("Error parsing response:", e);
        }
    });
}).on('error', (e) => {
    console.error("Request error:", e);
});
