require('dotenv').config();
const https = require('https');

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
    console.error("❌ GEMINI_API_KEY not found in .env");
    process.exit(1);
}

const checkApiVersion = (version) => {
    return new Promise((resolve) => {
        const url = `https://generativelanguage.googleapis.com/${version}/models?key=${API_KEY}`;
        console.log(`\n🔍 Checking version: ${version}...`);

        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (response.models) {
                        console.log(`✅ Models found in ${version}:`);
                        response.models.forEach(m => {
                            if (m.supportedGenerationMethods.includes('bidiGenerateContent')) {
                                console.log(`⭐ [SUPPORTED] ${m.name}`);
                            } else if (m.name.includes("2.0") || m.name.includes("exp")) {
                                console.log(`  [Found] ${m.name}`);
                            }
                        });
                    } else if (response.error) {
                        console.error(`❌ Error in ${version}:`, response.error.message);
                    } else {
                        console.log(`ℹ️ No models returned for ${version}`);
                    }
                    resolve();
                } catch (e) {
                    console.error(`❌ Error parsing ${version} response:`, e.message);
                    resolve();
                }
            });
        }).on('error', (e) => {
            console.error(`❌ Request error for ${version}:`, e.message);
            resolve();
        });
    });
};

(async () => {
    await checkApiVersion('v1alpha');
    await checkApiVersion('v1beta');
    console.log("\nDone.");
})();
