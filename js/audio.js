// CorrectMe Audio and Web Speech API Wrapper
// Handles Speech-to-Text (STT) and Text-to-Speech (TTS) using Web APIs or ElevenLabs API
import { Config } from './config.js?v=23';

export class AudioEngine {
  constructor() {
    this.recognition = null;
    this.synth = window.speechSynthesis;
    this.currentUtterance = null;
    this.isListening = false;
    
    // Web Audio Analyzer fields for real ElevenLabs speech visual reactivity
    this.audioContext = null;
    this.analyser = null;
    this.dataArray = null;
    this.audioElement = null;
    this.isElevenLabsPlaying = false;
    
    this.initSpeechRecognition();
  }

  initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech Recognition API is not supported in this browser.");
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'ar-EG'; // Listen in Egyptian Arabic (can recognize mixed English words too)
  }

  initAudioContext() {
    if (this.audioContext) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    
    try {
      this.audioContext = new AudioContextClass();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 128;
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    } catch (e) {
      console.error("Failed to initialize AudioContext:", e);
    }
  }

  getVolume() {
    // Only return real volume if ElevenLabs/Gemini TTS is playing and analyser is loaded
    if (!this.isElevenLabsPlaying || !this.analyser || !this.dataArray) return 0;
    
    this.analyser.getByteFrequencyData(this.dataArray);
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i];
    }
    const average = sum / this.dataArray.length;
    const volume = Math.min(1.0, average / 60); 
    return volume;
  }

  startListening(callbacks) {
    if (!this.recognition) {
      callbacks.onError?.("المتصفح بتاعك مش بيدعم ميزة التعرف على الصوت (Speech Recognition). جرب تستخدم Chrome أو Edge.");
      return;
    }

    if (this.isListening) return;
    this.isListening = true;

    // Clear any previous speaking
    this.stopSpeaking();

    // Initialize audio context on first user microphone interaction
    this.initAudioContext();
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    let finalTranscript = "";

    this.recognition.onstart = () => {
      callbacks.onStart?.();
    };

    this.recognition.onresult = (event) => {
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      callbacks.onResult?.(finalTranscript, interimTranscript);
    };

    this.recognition.onerror = (event) => {
      if (event.error === 'no-speech' && !this.isListening) return;
      console.error("Speech Recognition Error:", event.error);
      
      let arMessage = "حصلت مشكلة في الميكروفون.";
      if (event.error === 'not-allowed') {
        arMessage = "مش عارف أفتح المايك، اتأكد إنك مدي إذن للموقع عشان يستخدم الميكروفون.";
      } else if (event.error === 'no-speech') {
        arMessage = "مسمعتش حاجة! اتكلم كده وسمعني صوتك.";
      }
      
      callbacks.onError?.(arMessage);
      this.isListening = false;
    };

    this.recognition.onend = () => {
      this.isListening = false;
      callbacks.onEnd?.(finalTranscript.trim());
    };

    try {
      this.recognition.start();
    } catch (e) {
      console.error(e);
      this.isListening = false;
    }
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      this.isListening = false;
      this.recognition.stop();
    }
  }

  getAvailableVoices() {
    if (!this.synth) return [];
    // Only return non-Microsoft voices since user does not want them
    return this.synth.getVoices().filter(v => v.lang.startsWith('en') && !v.name.includes('Microsoft'));
  }

  /**
   * ElevenLabs TTS generator helper. Fetches raw audio blob from ElevenLabs.
   */
  async generateElevenLabsSpeech(text) {
    const apiKey = Config.getElevenLabsApiKey();
    const voiceId = Config.getElevenLabsVoiceId();

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey
      },
      body: JSON.stringify({
        text: text,
        model_id: "eleven_multilingual_v2", // Multilingual v2 supports Arabic and English perfectly!
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.1,
          use_speaker_boost: true
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`ElevenLabs Error: ${errText || response.statusText}`);
    }

    return await response.blob();
  }

  /**
   * Speak using browser Web Speech API (fallback)
   */
  speak(text, callbacks) {
    this.stopSpeaking();
    this.playSpeechSynthesisFallback(text, callbacks);
  }

  playSpeechSynthesisFallback(text, callbacks) {
    const chunks = this.splitArabicAndEnglish(text);
    if (chunks.length === 0) {
      callbacks.onEnd?.();
      return;
    }

    callbacks.onStart?.();
    this.playSpeechChunks(chunks, 0, callbacks);
  }

  splitArabicAndEnglish(text) {
    const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    const words = text.split(/\s+/);
    const chunks = [];
    let currentLang = null;
    let currentText = [];

    words.forEach(word => {
      const hasArabic = arabicRegex.test(word);
      const isArabic = hasArabic;
      const lang = isArabic ? 'ar' : 'en';

      if (currentLang === null) {
        currentLang = lang;
        currentText.push(word);
      } else if (currentLang === lang) {
        currentText.push(word);
      } else {
        chunks.push({
          text: currentText.join(' '),
          lang: currentLang
        });
        currentLang = lang;
        currentText = [word];
      }
    });

    if (currentText.length > 0) {
      chunks.push({
        text: currentText.join(' '),
        lang: currentLang
      });
    }

    return chunks;
  }

  playSpeechChunks(chunks, index, callbacks) {
    if (index >= chunks.length) {
      callbacks.onEnd?.();
      return;
    }

    const chunk = chunks[index];
    const utterance = new SpeechSynthesisUtterance(chunk.text);
    const voices = this.synth.getVoices();
    let selectedVoice = null;

    if (chunk.lang === 'ar') {
      // Avoid Microsoft online/offline voices completely as user dislikes them
      selectedVoice = voices.find(v => v.lang.startsWith('ar') && !v.name.includes('Microsoft') && !v.name.includes('Online')) ||
                      voices.find(v => v.lang.startsWith('ar') && v.name.includes('Google')) ||
                      voices.find(v => v.lang.startsWith('ar')) || 
                      null;
      utterance.lang = 'ar-EG';
      utterance.pitch = 1.0;
      utterance.rate = 1.05;
    } else {
      const preferredVoiceName = Config.getTtsVoice();
      // Avoid Microsoft voices completely
      selectedVoice = voices.find(v => v.name === preferredVoiceName) || 
                      voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) ||
                      voices.find(v => v.lang === 'en-US') || 
                      voices.find(v => v.lang.startsWith('en') && !v.name.includes('Microsoft')) ||
                      null;
      utterance.lang = 'en-US';
      utterance.pitch = 1.1;
      utterance.rate = Config.getSpeechRate();
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.onend = () => {
      this.playSpeechChunks(chunks, index + 1, callbacks);
    };

    utterance.onerror = (e) => {
      console.error("TTS Chunk Playback Error:", e);
      this.playSpeechChunks(chunks, index + 1, callbacks);
    };

    this.currentUtterance = utterance;
    this.synth.speak(utterance);
  }

  stopSpeaking() {
    this.isElevenLabsPlaying = false;
    if (this.synth) {
      this.synth.cancel();
    }
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.src = '';
      this.audioElement = null;
    }
    this.currentUtterance = null;
  }

  /**
   * Play a raw audio Blob (e.g., WAV from Gemini TTS or ElevenLabs) with Web Audio analysis for avatar reactivity.
   */
  async playAudioBlob(blob, callbacks) {
    this.stopSpeaking();
    
    const audioUrl = URL.createObjectURL(blob);
    this.audioElement = new Audio(audioUrl);

    // Wire up Web Audio analyzer for avatar mouth sync
    this.initAudioContext();
    if (this.audioContext) {
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      try {
        const source = this.audioContext.createMediaElementSource(this.audioElement);
        source.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
      } catch (e) {
        console.warn("Could not connect audio to analyser:", e);
      }
    }

    this.isElevenLabsPlaying = true; // reuse flag for avatar volume analysis

    this.audioElement.onplaying = () => {
      callbacks.onStart?.();
    };

    this.audioElement.onended = () => {
      this.isElevenLabsPlaying = false;
      URL.revokeObjectURL(audioUrl);
      callbacks.onEnd?.();
    };

    this.audioElement.onerror = (e) => {
      console.error("Audio Blob playback error:", e);
      this.isElevenLabsPlaying = false;
      URL.revokeObjectURL(audioUrl);
      callbacks.onEnd?.();
    };

    try {
      await this.audioElement.play();
    } catch (e) {
      console.error("Failed to play audio blob:", e);
      this.isElevenLabsPlaying = false;
      callbacks.onEnd?.();
    }
  }
}
