const apiKey = "AQ.Ab8RN6KiRr4CLprQGBpjjHiajiWVV6MQ2wTSYS2BiDvInmaGDw";

async function listModels() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  try {
    const response = await fetch(url);
    console.log("Status:", response.status);
    const data = await response.json();
    if (response.ok) {
      console.log("Models found:", data.models?.map(m => m.name));
    } else {
      console.log("Error:", JSON.stringify(data));
    }
  } catch (e) {
    console.log("Exception:", e.message);
  }
}

listModels();
