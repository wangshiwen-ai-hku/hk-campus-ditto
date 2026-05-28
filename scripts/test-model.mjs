import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to parse .env file
function loadEnv() {
  const envPath = path.join(__dirname, '../backend/.env');
  if (!fs.existsSync(envPath)) {
    console.error(`Error: .env file not found at ${envPath}`);
    process.exit(1);
  }
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      env[key] = value;
    }
  });
  return env;
}

async function run() {
  const env = loadEnv();
  const apiKey = env.LLM_API_KEY;
  const baseUrl = env.LLM_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta';
  
  // Model to test: argv[2] or fallback
  const model = process.argv[2] || 'gemini-3.1-flash-lite-preview';

  if (!apiKey) {
    console.error('Error: LLM_API_KEY not found in backend/.env');
    process.exit(1);
  }

  console.log(`\n========================================`);
  console.log(`Testing Gemini API`);
  console.log(`Model:   ${model}`);
  console.log(`BaseURL: ${baseUrl}`);
  console.log(`========================================\n`);

  try {
    const url = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: 'Say "Hello, world!" if you receive this message.',
              },
            ],
          },
        ],
      }),
    });

    const status = response.status;
    const data = await response.json();

    if (response.ok) {
      console.log(`✅ SUCCESS (HTTP ${status})`);
      console.log(`Response:`);
      console.log(data.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(data, null, 2));
    } else {
      console.error(`❌ FAILED (HTTP ${status})`);
      console.error(JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error(`❌ ERROR:`);
    console.error(error);
  }
}

run();
