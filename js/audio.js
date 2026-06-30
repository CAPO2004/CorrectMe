// CorrectMe Audio and Web Speech API Wrapper
// Handles Speech-to-Text (STT) and Text-to-Speech (TTS) using Web APIs or ElevenLabs API
import { Config } from './config.js?v=38';

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
    this.recognition.lang = 'en-US'; // Listen in English since the app is for English conversation practice
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
    if (!this.isElevenLabsPlaying) return 0;
    
    if (this.analyser && this.dataArray) {
      this.analyser.getByteFrequencyData(this.dataArray);
      let sum = 0;
      for (let i = 0; i < this.dataArray.length; i++) {
        sum += this.dataArray[i];
      }
      const average = sum / this.dataArray.length;
      if (average > 2) {
        return Math.min(1.0, average / 60);
      }
    }
    
    // Fallback: If playing but no analyser signal (e.g. cross-origin Google Translate TTS), 
    // generate a simulated speaking volume wave pattern to keep the avatar mouth animated
    return 0.15 + Math.sin(Date.now() / 80) * 0.12 + Math.random() * 0.08;
  }

  startListening(options) {
    if (!this.recognition) {
      options.onError?.("المتصفح بتاعك مش بيدعم ميزة التعرف على الصوت (Speech Recognition). جرب تستخدم Chrome أو Edge.");
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

    // Set dynamic language
    this.recognition.lang = options.lang || 'en-US';

    let finalTranscript = "";

    this.recognition.onstart = () => {
      options.onStart?.();
    };

    this.recognition.onresult = (event) => {
      let interimTranscript = "";
      let finalParts = [];
      for (let i = 0; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalParts.push(event.results[i][0].transcript.trim());
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      finalTranscript = finalParts.join(" ");
      options.onResult?.(finalTranscript, interimTranscript);
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
      
      options.onError?.(arMessage);
      this.isListening = false;
    };

    this.recognition.onend = () => {
      this.isListening = false;
      options.onEnd?.(finalTranscript.trim());
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
   * Speak using high-quality Google Translate TTS fallback (replaces robotic browser voice)
   */
  speak(text, callbacks) {
    this.stopSpeaking();
    
    // Check if text is mostly Arabic or English to select language tag
    const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    const isArabic = arabicRegex.test(text);
    const lang = isArabic ? 'ar' : 'en';

    this.playGoogleTranslateTTS(text, lang, callbacks);
  }

  playGoogleTranslateTTS(text, lang, callbacks) {
    // Split text into chunks of max 150 characters to stay within Google Translate's limit
    const chunks = [];
    const sentences = text.match(/[^.!?،؟]+[.!?،؟]*/g) || [text];
    
    let currentChunk = "";
    sentences.forEach(sentence => {
      if ((currentChunk + sentence).length > 150) {
        if (currentChunk.trim()) chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += " " + sentence;
      }
    });
    if (currentChunk.trim()) chunks.push(currentChunk.trim());

    if (chunks.length === 0) {
      callbacks.onEnd?.();
      return;
    }

    callbacks.onStart?.();
    this.isElevenLabsPlaying = true; // Enables avatar animation

    let currentIdx = 0;
    const playNext = () => {
      if (currentIdx >= chunks.length) {
        this.isElevenLabsPlaying = false;
        callbacks.onEnd?.();
        return;
      }

      const chunkText = chunks[currentIdx];
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodeURIComponent(chunkText)}`;
      
      this.audioElement = new Audio(url);
      
      this.audioElement.onended = () => {
        currentIdx++;
        playNext();
      };
      
      this.audioElement.onerror = (e) => {
        console.error("Google Translate TTS chunk error:", e);
        currentIdx++;
        playNext();
      };
      
      this.audioElement.play().catch(err => {
        console.error("Failed to play Google Translate TTS chunk:", err);
        this.isElevenLabsPlaying = false;
        callbacks.onEnd?.();
      });
    };

    playNext();
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
      throw e;
    }
  }
}
