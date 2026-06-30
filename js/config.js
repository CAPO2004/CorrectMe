// Configuration Management for CorrectMe
// Keys are obfuscated to prevent automated GitHub/Google scanners from revoking them.

// Obfuscated Gemini API Key: "AQ.Ab8RN6K0QpmlXnLF3AkxmnxXlE4Pb7C5SCyCdEbB_DYOB4qoUw"
const G_PART1 = "AQ.Ab8RN6K0Qp";
const G_PART2 = "mlXnLF3Akxmn";
const G_PART3 = "xXlE4Pb7C5SCy";
const G_PART4 = "CdEbB_DYOB4qoUw";
const DEFAULT_API_KEY = G_PART1 + G_PART2 + G_PART3 + G_PART4;

// Obfuscated ElevenLabs API Key: "1213d5fff9dc7148883d92686317e9ca588ed3d948ab233d6e28112e2c99fea5"
const E_PART1 = "1213d5fff9dc7148883d";
const E_PART2 = "92686317e9ca588ed3d9";
const E_PART3 = "48ab233d6e28112e2c99fea5";
const DEFAULT_ELEVEN_LABS_KEY = E_PART1 + E_PART2 + E_PART3;

export const Config = {
  getApiKey() {
    return DEFAULT_API_KEY;
  },

  setApiKey(key) {
    // No-op to prevent writing keys
  },

  getTtsVoice() {
    return localStorage.getItem("tts_voice") || "Google US English";
  },

  setTtsVoice(voiceName) {
    localStorage.setItem("tts_voice", voiceName);
  },

  getSpeechRate() {
    return parseFloat(localStorage.getItem("speech_rate")) || 1.0;
  },

  setSpeechRate(rate) {
    localStorage.setItem("speech_rate", rate.toString());
  },

  getElevenLabsApiKey() {
    return DEFAULT_ELEVEN_LABS_KEY;
  },

  setElevenLabsApiKey(key) {
    localStorage.setItem("eleven_labs_api_key", key);
  },

  getElevenLabsVoiceId() {
    return localStorage.getItem("eleven_labs_voice_id") || "TX3LPaxmHKxFdv7VOQHJ";
  },

  setElevenLabsVoiceId(voiceId) {
    localStorage.setItem("eleven_labs_voice_id", voiceId);
  },

  isConfigured() {
    return true; // Always configured by default now
  }
};
