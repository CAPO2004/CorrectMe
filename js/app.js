// Main Application Controller for CorrectMe
import { Config } from './config.js?v=36';
import { Avatar } from './avatar.js?v=36';
import { AudioEngine } from './audio.js?v=36';
import { sendChatMessage, geminiTTS, generateWelcomeGreeting } from './api.js?v=36';

class AppController {
  constructor() {
    this.avatar = null;
    this.audio = null;
    this.history = [];
    this.currentState = 'idle'; // idle, listening, thinking, speaking
    this.spacePressed = false;
    this.currentLang = 'en-US'; // Default speech input language: English

    // Cache DOM Elements
    this.elements = {
      avatarContainer: document.querySelector('.avatar-container'),
      canvas: document.getElementById('avatar-canvas'),
      statusText: document.getElementById('status-text'),
      interimText: document.getElementById('interim-text'),
      historyContainer: document.getElementById('history-container'),
      historyPanel: document.getElementById('history-panel'),
      toggleHistoryBtn: document.getElementById('toggle-history-btn'),
      langEn: document.getElementById('lang-en'),
      langAr: document.getElementById('lang-ar')
    };
  }

  init() {
    // Clear any stale ElevenLabs voice ID that may reference a paid-only voice
    const storedVoiceId = localStorage.getItem("eleven_labs_voice_id");
    if (storedVoiceId === "21m00Tcm4TlvDq8ikWAM") {
      localStorage.removeItem("eleven_labs_voice_id"); // Force switch to free premade voice
    }

    // 1. Initialize Audio Engine first so avatar can reference it for audio analysis
    this.audio = new AudioEngine();

    // 2. Initialize Avatar Engine (pass audio context)
    this.avatar = new Avatar(this.elements.canvas, this.audio);
    this.avatar.animate();

    // 3. Bind UI & Keyboard Events
    this.bindEvents();

    // 4. Initial state setup
    this.setAppState('thinking');
    this.elements.statusText.textContent = "جاري استدعاء المعلم المصري الساخر... ⏳";

    // 5. Generate a unique, AI-generated welcome greeting from Gemini dynamically!
    generateWelcomeGreeting().then(async (welcomeText) => {
      this.history.push({ role: 'model', content: welcomeText });
      this.addMessageToPanel('model', welcomeText);
      this.setAppState('idle');

      let spoken = false;
      const playGreeting = async () => {
        if (spoken) return;
        spoken = true;
        
        // Remove event listeners
        document.removeEventListener('click', playGreeting);
        document.removeEventListener('keydown', playGreeting);
        
        await this.speakWithGeminiTTS(welcomeText);
      };

      // Try playing immediately. Note that modern browsers block audio without a user interaction.
      // If it gets blocked, it will throw an exception, so we catch it and register interaction listeners.
      try {
        await playGreeting();
      } catch (err) {
        console.log("Autoplay blocked. Waiting for first user interaction to play greeting...");
        spoken = false; // Reset so user interaction can trigger it
        document.addEventListener('click', playGreeting);
        document.addEventListener('keydown', playGreeting);
      }
    }).catch(err => {
      console.error("Failed to generate dynamic welcome greeting:", err);
      // Fallback greeting if api fails
      const fallbackGreeting = "أهلاً يا فصيح! اضغط على صورتي عشان نبدأ الهبد.";
      this.history.push({ role: 'model', content: fallbackGreeting });
      this.addMessageToPanel('model', fallbackGreeting);
      this.setAppState('idle');
    });
  }

  bindEvents() {
    let pressTimer = null;
    let isHolding = false;
    let pressStartTime = 0;

    const handlePressStart = (e) => {
      // Prevent browser default behaviors like scrolling or selection on the avatar
      if (e.type === 'touchstart') {
        e.preventDefault();
      }
      
      pressStartTime = Date.now();
      isHolding = false;

      // Only prepare recording if we are currently idle or speaking (can interrupt speaking)
      if (this.currentState === 'idle' || this.currentState === 'speaking') {
        pressTimer = setTimeout(() => {
          isHolding = true;
          this.startRecording();
        }, 350);
      }
    };

    const handlePressEnd = (e) => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }

      const duration = Date.now() - pressStartTime;

      if (duration < 350) {
        // Short tap/click - toggle mic
        this.toggleMic();
      } else {
        // Long press release - stop recording if we are currently listening
        if (isHolding && this.currentState === 'listening') {
          this.stopRecording();
        }
      }
      isHolding = false;
    };

    // Mouse events
    this.elements.avatarContainer.addEventListener('mousedown', handlePressStart);
    this.elements.avatarContainer.addEventListener('mouseup', handlePressEnd);
    this.elements.avatarContainer.addEventListener('mouseleave', () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
      if (isHolding && this.currentState === 'listening') {
        this.stopRecording();
      }
      isHolding = false;
    });

    // Touch events for mobile phones
    this.elements.avatarContainer.addEventListener('touchstart', handlePressStart, { passive: false });
    this.elements.avatarContainer.addEventListener('touchend', handlePressEnd);
    this.elements.avatarContainer.addEventListener('touchcancel', () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
      if (isHolding && this.currentState === 'listening') {
        this.stopRecording();
      }
      isHolding = false;
    });

    // Spacebar Toggle Mode
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !this.isModalOpen()) {
        e.preventDefault();
        if (e.repeat) return;
        this.toggleMic();
      }
    });

    // History Toggle
    this.elements.toggleHistoryBtn.addEventListener('click', () => {
      this.elements.historyPanel.classList.toggle('open');
    });

    // Language Switcher Toggle Click Handlers
    const setLanguage = (lang) => {
      this.currentLang = lang;
      if (lang === 'en-US') {
        this.elements.langEn.classList.add('active');
        this.elements.langAr.classList.remove('active');
      } else {
        this.elements.langAr.classList.add('active');
        this.elements.langEn.classList.remove('active');
      }
      console.log("Speech recognition language set to:", lang);
    };

    if (this.elements.langEn && this.elements.langAr) {
      this.elements.langEn.addEventListener('click', () => setLanguage('en-US'));
      this.elements.langAr.addEventListener('click', () => setLanguage('ar-EG'));
    }
  }

  isModalOpen() {
    return false; // settings modal removed
  }

  setAppState(state) {
    this.currentState = state;
    this.avatar.setState(state);
    
    // Reset state styling on avatar container & update status indicator texts
    this.elements.avatarContainer.className = 'avatar-container';
    this.elements.interimText.classList.remove('active');

    switch (state) {
      case 'idle':
        this.elements.statusText.textContent = "اضغط على المعلم للتحدث (أو زر المسافة Space) 🎤";
        this.elements.avatarContainer.classList.add('idle');
        break;
      case 'listening':
        this.elements.statusText.textContent = "سامعك.. اتكلم وريني شطارتك! 👂 (اضغط على المعلم لإنهاء الكلام)";
        this.elements.avatarContainer.classList.add('recording');
        this.elements.interimText.classList.add('active');
        this.elements.interimText.textContent = "...";
        break;
      case 'thinking':
        this.elements.statusText.textContent = "بفكر في تريقة تليق بيك... 🤔";
        this.elements.avatarContainer.classList.add('thinking');
        break;
      case 'speaking':
        this.elements.statusText.textContent = "اسمع المعلم وهو بيروقك... 🗣️";
        this.elements.avatarContainer.classList.add('speaking');
        break;
    }
  }

  toggleMic() {
    if (this.currentState === 'idle') {
      this.startRecording();
    } else if (this.currentState === 'listening') {
      this.stopRecording();
    } else if (this.currentState === 'speaking') {
      this.audio.stopSpeaking();
      this.startRecording();
    }
  }

  startRecording() {
    this.setAppState('listening');
    this.audio.startListening({
      lang: this.currentLang,
      onStart: () => {},
      onResult: (final, interim) => {
        this.elements.interimText.textContent = final + (interim ? ` ${interim}` : '');
      },
      onEnd: (finalTranscript) => {
        this.processUserSpeech(finalTranscript);
      },
      onError: (errMsg) => {
        alert(errMsg);
        this.setAppState('idle');
      }
    });
  }

  stopRecording() {
    if (this.currentState === 'listening') {
      this.audio.stopListening();
    }
  }

  async speakWithGeminiTTS(text) {
    const elevenKey = Config.getElevenLabsApiKey();
    this.elements.statusText.textContent = "جاري تحضير الرد الصوتي... 🎙️";
    
    // 1. Try ElevenLabs TTS first if Key is set
    if (elevenKey) {
      try {
        console.log("Requesting ElevenLabs TTS...");
        const audioBlob = await this.audio.generateElevenLabsSpeech(text);
        if (audioBlob) {
          console.log("ElevenLabs TTS success! Playing audio...");
          return new Promise((resolve) => {
            this.audio.playAudioBlob(audioBlob, {
              onStart: () => {
                this.setAppState('speaking');
              },
              onEnd: () => {
                this.setAppState('idle');
                resolve();
              }
            });
          });
        }
      } catch (err) {
        console.warn("ElevenLabs TTS failed, falling back to Gemini TTS:", err);
      }
    }

    // 2. Try Gemini TTS next (human-like, free) with retry logic for 429/503 errors
    const attempts = 3;
    const retryDelay = 2500;

    for (let i = 0; i < attempts; i++) {
      try {
        console.log(`Requesting Gemini TTS (Attempt ${i + 1}/${attempts}) for:`, text.substring(0, 60) + "...");
        const audioBlob = await geminiTTS(text);
        
        if (audioBlob) {
          console.log("Gemini TTS success! Playing audio...");
          return new Promise((resolve) => {
            this.audio.playAudioBlob(audioBlob, {
              onStart: () => {
                this.setAppState('speaking');
              },
              onEnd: () => {
                this.setAppState('idle');
                resolve();
              }
            });
          });
        }
      } catch (err) {
        console.warn(`Gemini TTS attempt ${i + 1} failed:`, err);
        // Wait and retry if not the last attempt
        if (i < attempts - 1) {
          this.elements.statusText.textContent = "الخادم مشغول، هحاول أشغل الصوت تاني في ثواني... ⏳";
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
      }
    }

    // 3. Ultimate Fallback: Browser Web Speech API (so it never goes mute!)
    console.warn("All advanced TTS engines failed. Falling back to native Web Speech API...");
    this.elements.statusText.textContent = "جاري استخدام الصوت الاحتياطي... 🔊";
    return new Promise((resolve) => {
      this.audio.speak(text, {
        onStart: () => {
          this.setAppState('speaking');
        },
        onEnd: () => {
          this.setAppState('idle');
          resolve();
        }
      });
    });
  }

  async processUserSpeech(transcript) {
    if (!transcript) {
      this.setAppState('idle');
      return;
    }

    // Add User message to panel and history
    this.addMessageToPanel('user', transcript);
    this.history.push({ role: 'user', content: transcript });

    this.setAppState('thinking');

    try {
      // Call Gemini API
      const reply = await sendChatMessage(this.history);
      
      this.history.push({ role: 'model', content: reply });
      this.addMessageToPanel('model', reply);
      
      // Start Playing Speech (try Gemini TTS first for human-quality voice, fallback to Web Speech API)
      await this.speakWithGeminiTTS(reply);

    } catch (err) {
      console.error(err);
      this.addMessageToPanel('system', `عطل فني: ${err.message}`);
      this.elements.statusText.textContent = `حصل خطأ: ${err.message} ⚠️`;
      this.setAppState('idle');
    }
  }

  addMessageToPanel(sender, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `msg ${sender}`;

    const labelSpan = document.createElement('span');
    labelSpan.className = 'msg-label';
    labelSpan.textContent = sender === 'user' ? 'أنت' : (sender === 'model' ? 'المعلم' : 'النظام');
    msgDiv.appendChild(labelSpan);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'msg-content';
    
    if (sender === 'model') {
      // Highlight corrections inside AI response. 
      // Gemini response often has English quotes or words like "..." or Correct sentence: "...".
      // Let's replace any double quotes in English with highlighted styling.
      // e.g. "I am happy" -> <span class="correction">"I am happy"</span>
      let formattedText = text
        .replace(/\n/g, '<br>')
        .replace(/"([^"]*[a-zA-Z]+[^"]*)"/g, '<span class="correction-highlight">"$1"</span>')
        .replace(/'([^']*[a-zA-Z]+[^']*)'/g, '<span class="correction-highlight">\'$1\'</span>');
      
      contentDiv.innerHTML = formattedText;
    } else {
      contentDiv.textContent = text;
    }

    msgDiv.appendChild(contentDiv);
    this.elements.historyContainer.appendChild(msgDiv);
    
    // Auto scroll history
    this.elements.historyContainer.scrollTop = this.elements.historyContainer.scrollHeight;
  }

}

// Instantiate and start app on page load
window.addEventListener('DOMContentLoaded', () => {
  const app = new AppController();
  app.init();
});
