const ELEVEN_KEY = "1213d5fff9dc7148883d92686317e9ca588ed3d948ab233d6e28112e2c99fea5";

// Test with premade voice (Liam - Energetic, Confident)
const VOICE_ID = "TX3LPaxmHKxFdv7VOQHJ";

async function testTTS() {
  console.log("Testing ElevenLabs TTS with premade voice (Liam)...");
  
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': ELEVEN_KEY
    },
    body: JSON.stringify({
      text: "يا بهيم! الجملة الصح هي: I went to school by bus. يلا كمل يا جحش.",
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.1,
        use_speaker_boost: true
      }
    })
  });

  console.log("Status:", response.status);
  
  if (response.ok) {
    const blob = await response.blob();
    console.log("SUCCESS! Audio size:", blob.size, "bytes, type:", blob.type);
  } else {
    const text = await response.text();
    console.log("ERROR:", text.substring(0, 300));
  }
}

testTTS();
