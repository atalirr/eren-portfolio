const fs = require('fs');
const https = require('https');

const envContent = fs.readFileSync('.env', 'utf8');
let apiKey = '';
for (const line of envContent.split('\n')) {
  if (line.startsWith('GEMINI_API_KEY=')) {
    apiKey = line.split('=')[1].trim();
    break;
  }
}

if (!apiKey) {
  console.error('API Key not found in .env');
  process.exit(1);
}

console.log('Testing Gemini API key ending in:', apiKey.slice(-6));

const payload = JSON.stringify({
  contents: [{
    parts: [{
      text: 'Translate the following English words into Turkish for an English vocabulary app: ["serendipity", "photosynthesis"]. Return a valid JSON array of objects with keys: "word", "turkish", "type", "phonetic".'
    }]
  }],
  generationConfig: {
    responseMimeType: 'application/json'
  }
});

const url = new URL('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey);

const req = https.request(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('HTTP Status:', res.statusCode);
    try {
      const parsed = JSON.parse(data);
      if (parsed.candidates && parsed.candidates[0]) {
        console.log('SUCCESS! Gemini JSON output:');
        console.log(parsed.candidates[0].content.parts[0].text);
      } else {
        console.log('Response:', data.slice(0, 300));
      }
    } catch(e) {
      console.log('Parse error:', e.message, data.slice(0, 200));
    }
  });
});

req.on('error', err => console.error('Network error:', err));
req.write(payload);
req.end();
