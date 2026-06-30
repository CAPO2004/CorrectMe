const ELEVEN_KEY = "1213d5fff9dc7148883d92686317e9ca588ed3d948ab233d6e28112e2c99fea5";

async function listVoices() {
  console.log("Fetching available voices...");
  
  const response = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": ELEVEN_KEY }
  });

  const data = await response.json();
  
  if (data.voices) {
    console.log(`Found ${data.voices.length} voices:\n`);
    data.voices.forEach(v => {
      const labels = v.labels || {};
      console.log(`  Name: ${v.name}`);
      console.log(`  ID:   ${v.voice_id}`);
      console.log(`  Category: ${v.category}`);
      console.log(`  Labels: ${JSON.stringify(labels)}`);
      console.log(`  ---`);
    });
  } else {
    console.log("Response:", JSON.stringify(data, null, 2));
  }
}

listVoices();
