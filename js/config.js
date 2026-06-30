// Configuration Management for CorrectMe
// Keys are loaded from the server (admin-config.json) so changes apply to ALL users

const G_PART1 = "AQ.Ab8RN6Ldx8R";
const G_PART2 = "0PCxkhk72cTS";
const G_PART3 = "LjNpAiv_JBcuL";
const G_PART4 = "Ca_jwnZhKxOdrA";
const DEFAULT_API_KEY = G_PART1 + G_PART2 + G_PART3 + G_PART4;

const E_PART1 = "1213d5fff9dc7148883d";
const E_PART2 = "92686317e9ca588ed3d9";
const E_PART3 = "48ab233d6e28112e2c99fea5";
const DEFAULT_ELEVEN_LABS_KEY = E_PART1 + E_PART2 + E_PART3;

// Server-loaded keys (overrides defaults when set by admin)
let serverGeminiKey = '';
let serverElevenKey = '';
let configLoaded = false;

export const Config = {
  // Fetch keys from server on startup (called once in app.js init)
  async init() {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        serverGeminiKey = data.geminiKey || '';
        serverElevenKey = data.elevenLabsKey || '';
        configLoaded = true;
        console.log('Config loaded from server.',
          data.hasCustomGemini ? '🟢 Custom Gemini Key' : '⚪ Default Gemini Key',
          data.hasCustomEleven ? '🟢 Custom ElevenLabs Key' : '⚪ Default ElevenLabs Key'
        );
      }
    } catch (err) {
      console.warn('Could not load server config, using defaults:', err);
    }
  },

  getApiKey() {
    // Server key takes priority, then fall back to default
    return serverGeminiKey || DEFAULT_API_KEY;
  },

  getElevenLabsApiKey() {
    // Server key takes priority, then fall back to default
    return serverElevenKey || DEFAULT_ELEVEN_LABS_KEY;
  },

  // Save keys via server API (requires admin auth)
  async saveKeysToServer(username, password, geminiKey, elevenLabsKey) {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, geminiKey, elevenLabsKey })
    });
    return res.json();
  },

  // Reset keys on server (requires admin auth)
  async resetKeysOnServer(username, password) {
    const res = await fetch('/api/config', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    return res.json();
  },

  // Verify admin login
  async verifyAdmin(username, password) {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    return res.json();
  },

  isUsingCustomGeminiKey() {
    return !!serverGeminiKey;
  },

  isUsingCustomElevenKey() {
    return !!serverElevenKey;
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

  getElevenLabsVoiceId() {
    return localStorage.getItem("eleven_labs_voice_id") || "TX3LPaxmHKxFdv7VOQHJ";
  },

  setElevenLabsVoiceId(voiceId) {
    localStorage.setItem("eleven_labs_voice_id", voiceId);
  },

  isConfigured() {
    return true;
  }
};
