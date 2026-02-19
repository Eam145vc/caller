const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const path = require('path');

ffmpeg.setFfmpegPath(ffmpegPath);

const inputPath = path.join(__dirname, 'assets', 'temp_source.mp3');
// We want RAW PCM 16-bit Little Endian (s16le) at 8000Hz
// This is easiest to mix mathematically.
const outputPath = path.join(__dirname, 'assets', 'office_noise_v3.pcm');

console.log('Converting...', inputPath);

ffmpeg(inputPath)
    .audioChannels(1)
    .audioFrequency(8000)
    .format('s16le') // Raw PCM 16-bit little-endian
    .on('end', () => {
        console.log('Conversion finished!');
    })
    .on('error', (err) => {
        console.error('Error:', err);
    })
    .save(outputPath);
