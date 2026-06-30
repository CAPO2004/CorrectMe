import { sendChatMessage } from '../js/api.js?v=14';
import { Config } from '../js/config.js?v=14';

// Mock Config for local test
Config.getApiKey = () => "AQ.Ab8RN6KiRr4CLprQGBpjjHiajiWVV6MQ2wTSYS2BiDvInmaGDw";

async function run() {
  const history = [
    { role: 'model', content: "أهلاً يا فصيح! أنا المعلم الساخر بتاعك النهاردة. يلا وريني إنجليزيتك العبقرية..." },
    { role: 'user', content: "I really like coffee in morning." }
  ];
  
  try {
    console.log("Calling Gemini API...");
    const reply = await sendChatMessage(history);
    console.log("RAW REPLY FROM GEMINI:\n", reply);
  } catch (error) {
    console.error("Error:", error);
  }
}

run();
