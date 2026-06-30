// Configuration Management for CorrectMe

const DEFAULT_API_KEY = "AQ.Ab8RN6LxApgJK6N_RARd6v9pR9kaXFKKhATAWUUsp-R-GFMU6Q";
const DEFAULT_ELEVEN_LABS_KEY = "1213d5fff9dc7148883d92686317e9ca588ed3d948ab233d6e28112e2c99fea5";

export const Config = {
  getApiKey() {
    return localStorage.getItem("gemini_api_key") || DEFAULT_API_KEY;
  },

  setApiKey(key) {
    localStorage.setItem("gemini_api_key", key);
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
    return localStorage.getItem("eleven_labs_api_key") || DEFAULT_ELEVEN_LABS_KEY;
  },

  setElevenLabsApiKey(key) {
    localStorage.setItem("eleven_labs_api_key", key);
  },

  getElevenLabsVoiceId() {
    return localStorage.getItem("eleven_labs_voice_id") || "TX3LPaxmHKxFdv7VOQHJ"; // Default: Liam - Energetic, Confident (premade/free)
  },

  setElevenLabsVoiceId(voiceId) {
    localStorage.setItem("eleven_labs_voice_id", voiceId);
  }
};
