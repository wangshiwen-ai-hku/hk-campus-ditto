import 'dotenv/config';

async function testGemini() {
  const apiKey = process.env.LLM_API_KEY;
  const baseUrl = process.env.LLM_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta';
  const model = process.env.LLM_MODEL || 'gemini-1.5-flash';

  if (!apiKey) {
    console.error('Error: LLM_API_KEY not found in .env file');
    process.exit(1);
  }

  console.log(`Testing Gemini API...`);
  console.log(`Model: ${model}`);
  console.log(`URL: ${baseUrl}/models/${model}:generateContent`);

  try {
    const response = await fetch(`${baseUrl}/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: 'Hello, this is a test. Are you working?',
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log('\n✅ Success! Gemini API is working.');
      console.log('Response:');
      console.log(data.candidates?.[0]?.content?.parts?.[0]?.text || 'No text in response');
    } else {
      console.error('\n❌ Failed! Gemini API returned an error:');
      console.error(JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('\n❌ Error occurred during API call:');
    console.error(error);
  }
}

testGemini();
