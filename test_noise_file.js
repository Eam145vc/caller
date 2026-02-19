const fs = require('fs');
const path = require('path');

const NOISE_PATH = path.join(__dirname, 'assets/office_noise_v3.pcm');

if (!fs.existsSync(NOISE_PATH)) {
    console.error("Noise file not found.");
    process.exit(1);
}

const noiseBuffer = fs.readFileSync(NOISE_PATH);
console.log(`Loaded noise buffer. Size: ${noiseBuffer.length}`);

// Read a few samples and check their values to ensure it's not silent
let nonZeroCount = 0;
let maxVal = 0;

// Since it's s16le, we read 2 bytes at a time
for (let i = 0; i < noiseBuffer.length && i < 10000; i += 2) {
    const val = noiseBuffer.readInt16LE(i);
    if (Math.abs(val) > 0) nonZeroCount++;
    if (Math.abs(val) > maxVal) maxVal = Math.abs(val);
}

console.log(`First 5000 samples: Non-zero = ${nonZeroCount}, Max absolute value = ${maxVal}`);

// If maxVal is extremely small, it means the audio is essentially silence
if (maxVal < 100) {
    console.log("WARNING: The noise audio file is extremely quiet or silent.");
} else {
    console.log("SUCCESS: The noise audio file contains actual sound data.");
}
