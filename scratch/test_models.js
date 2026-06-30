const apiKey = "AQ.Ab8RN6KiRr4CLprQGBpjjHiajiWVV6MQ2wTSYS2BiDvInmaGDw";

async function testGeminiModels() {
  const models = [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
    'gemini-2.0-pro-exp-02-05',
    'gemini-1.5-flash',
    'gemini-1.5-pro'
  ];

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Hello" }] }]
        })
      });

      console.log(`Model: ${model} -> Status: ${response.status}`);
      const data = await response.json();
      if (response.ok) {
        console.log(`  Response: ${data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()}`);
      } else {
        console.log(`  Error: ${JSON.stringify(data.error)}`);
      }
    } catch (e) {
      console.log(`Model: ${model} -> Exception: ${e.message}`);
    }
    console.log("---");
  }
}

testGeminiModels();
