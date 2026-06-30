const apiKey = "AQ.Ab8RN6KiRr4CLprQGBpjjHiajiWVV6MQ2wTSYS2BiDvInmaGDw";

async function testTTS(model, inputText, voiceName) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  console.log(`Testing model: ${model}, voice: ${voiceName}`);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: inputText }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voiceName
              }
            }
          }
        }
      })
    });
    const status = response.status;
    const body = await response.text();
    
    if (status === 200) {
      const data = JSON.parse(body);
      if (data.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
        const audioData = data.candidates[0].content.parts[0].inlineData;
        console.log(`SUCCESS! Model: ${model}, Voice: ${voiceName}, MimeType: ${audioData.mimeType}, DataSize: ${audioData.data.length} chars`);
      } else {
        console.log(`Model: ${model}, Status: 200, no audio. Response: ${body.substring(0, 200)}`);
      }
    } else {
      console.log(`Model: ${model}, Status: ${status}, Err: ${body.substring(0, 200)}`);
    }
  } catch (error) {
    console.error(`Error:`, error.message);
  }
}

async function run() {
  const t = "يا حمار! الجملة الصح هي I went to school by bus. برافو كده.";
  
  await testTTS("gemini-2.5-flash-preview-tts", t, "Puck");
  await testTTS("gemini-2.5-flash", t, "Puck");
  await testTTS("gemini-2.0-flash", t, "Puck");
}

run();
