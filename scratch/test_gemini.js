const apiKey = "AQ.Ab8RN6KiRr4CLprQGBpjjHiajiWVV6MQ2wTSYS2BiDvInmaGDw";

async function testModel(model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "Hello" }] }]
      })
    });
    const status = response.status;
    const text = await response.text();
    console.log(`Model: ${model} | Status: ${status} | Msg: ${text.substring(0, 200)}`);
  } catch (error) {
    console.error(`Error for ${model}:`, error);
  }
}

async function run() {
  await testModel("gemini-1.5-flash");
  await testModel("gemini-1.5-flash-8b");
  await testModel("gemini-2.0-flash");
  await testModel("gemini-2.5-flash");
  await testModel("gemini-3.5-flash");
  await testModel("gemini-2.5-pro");
}

run();
