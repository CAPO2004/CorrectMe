// Main Application Controller for CorrectMe
import { Config } from './config.js?v=38';
import { Avatar } from './avatar.js?v=38';
import { AudioEngine } from './audio.js?v=38';
import { sendChatMessage, geminiTTS, generateWelcomeGreeting } from './api.js?v=38';

class AppController {
  constructor() {
    this.avatar = null;
    this.audio = null;
    this.history = [];
    this.currentState = 'idle'; // idle, listening, thinking, speaking
    this.spacePressed = false;
    this.currentLang = 'en-US'; // Default speech input language: English
    this.adminCredentials = null; // stored after login { username, password }

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

  async init() {
    // 0. Load API keys from server FIRST
    await Config.init();

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

    // Secret Admin Panel: 5 rapid clicks on logo
    this.bindAdminPanel();
  }

  bindAdminPanel() {
    const logo = document.getElementById('logo');
    const overlay = document.getElementById('admin-overlay');
    const closeBtn = document.getElementById('admin-close');
    const loginBtn = document.getElementById('admin-login-btn');
    const saveBtn = document.getElementById('admin-save');
    const resetBtn = document.getElementById('admin-reset');

    if (!logo || !overlay) return;

    // URL parameter trigger: ?admin=1
    if (new URLSearchParams(window.location.search).get('admin') === '1') {
      setTimeout(() => this.openAdminPanel(), 500);
    }

    // 5-click secret trigger (1.5s window)
    let clickCount = 0;
    let clickTimer = null;
    logo.addEventListener('click', () => {
      clickCount++;
      if (clickTimer) clearTimeout(clickTimer);
      clickTimer = setTimeout(() => { clickCount = 0; }, 1500);
      if (clickCount >= 5) {
        clickCount = 0;
        this.openAdminPanel();
      }
    });

    // Close
    closeBtn?.addEventListener('click', () => this.closeAdminPanel());
    overlay?.addEventListener('click', (e) => {
      if (e.target === overlay) this.closeAdminPanel();
    });

    // Eye toggle buttons
    document.querySelectorAll('.admin-toggle-eye').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = document.getElementById(btn.dataset.target);
        if (input) {
          input.type = input.type === 'password' ? 'text' : 'password';
        }
      });
    });

    // Login button
    loginBtn?.addEventListener('click', async () => {
      const username = document.getElementById('admin-username').value.trim();
      const password = document.getElementById('admin-password').value.trim();
      const loginStatus = document.getElementById('login-status');

      if (!username || !password) {
        loginStatus.textContent = 'ادخل اليوزر والباسورد';
        loginStatus.className = 'admin-status error';
        return;
      }

      loginBtn.disabled = true;
      loginBtn.textContent = '⏳ جاري التحقق...';

      try {
        const result = await Config.verifyAdmin(username, password);
        if (result.success) {
          this.adminCredentials = { username, password };
          loginStatus.textContent = result.message;
          loginStatus.className = 'admin-status success';

          // Show keys section, hide login
          setTimeout(() => {
            document.getElementById('admin-login-section').style.display = 'none';
            const keysSection = document.getElementById('admin-keys-section');
            keysSection.style.display = 'block';
            this.updateKeyStatuses();
          }, 600);
        } else {
          loginStatus.textContent = result.message;
          loginStatus.className = 'admin-status error';
        }
      } catch (err) {
        loginStatus.textContent = 'خطأ في الاتصال بالسيرفر';
        loginStatus.className = 'admin-status error';
      }

      loginBtn.disabled = false;
      loginBtn.textContent = '🔓 دخول';
    });

    // Enter key to login
    document.getElementById('admin-password')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') loginBtn?.click();
    });

    // Save keys to server
    saveBtn?.addEventListener('click', async () => {
      if (!this.adminCredentials) return;
      
      const geminiInput = document.getElementById('admin-gemini-key');
      const elevenInput = document.getElementById('admin-eleven-key');
      const geminiStatus = document.getElementById('gemini-status');
      const gKey = geminiInput.value.trim();
      const eKey = elevenInput.value.trim();

      if (!gKey && !eKey) {
        geminiStatus.textContent = 'اكتب key واحد على الأقل';
        geminiStatus.className = 'admin-status error';
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = '⏳ جاري الحفظ...';

      try {
        const body = { ...this.adminCredentials };
        if (gKey) body.geminiKey = gKey;
        if (eKey) body.elevenLabsKey = eKey;

        const result = await Config.saveKeysToServer(
          this.adminCredentials.username,
          this.adminCredentials.password,
          gKey || undefined,
          eKey || undefined
        );

        if (result.success) {
          geminiStatus.textContent = '✅ ' + result.message;
          geminiStatus.className = 'admin-status success';
          setTimeout(() => {
            this.closeAdminPanel();
            location.reload();
          }, 1500);
        } else {
          geminiStatus.textContent = '❌ ' + result.message;
          geminiStatus.className = 'admin-status error';
        }
      } catch (err) {
        geminiStatus.textContent = 'خطأ في الاتصال بالسيرفر';
        geminiStatus.className = 'admin-status error';
      }

      saveBtn.disabled = false;
      saveBtn.textContent = '💾 حفظ وتطبيق';
    });

    // Reset to defaults
    resetBtn?.addEventListener('click', async () => {
      if (!this.adminCredentials) return;
      
      const geminiStatus = document.getElementById('gemini-status');
      resetBtn.disabled = true;

      try {
        const result = await Config.resetKeysOnServer(
          this.adminCredentials.username,
          this.adminCredentials.password
        );

        if (result.success) {
          geminiStatus.textContent = '🔄 ' + result.message;
          geminiStatus.className = 'admin-status info';
          setTimeout(() => location.reload(), 1500);
        } else {
          geminiStatus.textContent = '❌ ' + result.message;
          geminiStatus.className = 'admin-status error';
        }
      } catch (err) {
        geminiStatus.textContent = 'خطأ في الاتصال بالسيرفر';
        geminiStatus.className = 'admin-status error';
      }

      resetBtn.disabled = false;
    });
  }

  updateKeyStatuses() {
    const geminiStatus = document.getElementById('gemini-status');
    const elevenStatus = document.getElementById('eleven-status');

    if (Config.isUsingCustomGeminiKey()) {
      geminiStatus.textContent = '🟢 يستخدم Key مخصص (متغير عند كل المستخدمين)';
      geminiStatus.className = 'admin-status success';
    } else {
      geminiStatus.textContent = '⚪ يستخدم Key الافتراضي';
      geminiStatus.className = 'admin-status info';
    }
    if (Config.isUsingCustomElevenKey()) {
      elevenStatus.textContent = '🟢 يستخدم Key مخصص (متغير عند كل المستخدمين)';
      elevenStatus.className = 'admin-status success';
    } else {
      elevenStatus.textContent = '⚪ يستخدم Key الافتراضي';
      elevenStatus.className = 'admin-status info';
    }
  }

  openAdminPanel() {
    const overlay = document.getElementById('admin-overlay');
    // Reset to login step
    document.getElementById('admin-login-section').style.display = 'block';
    document.getElementById('admin-keys-section').style.display = 'none';
    document.getElementById('admin-username').value = '';
    document.getElementById('admin-password').value = '';
    document.getElementById('login-status').textContent = '';
    this.adminCredentials = null;
    overlay.classList.add('open');
  }

  closeAdminPanel() {
    document.getElementById('admin-overlay')?.classList.remove('open');
  }

  isModalOpen() {
    const adminOverlay = document.getElementById('admin-overlay');
    return adminOverlay && adminOverlay.classList.contains('open');
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

    // 3. Ultimate Fallback: Skip speech and just show text (so it never hangs!)
    console.warn("All advanced TTS engines failed. Showing text only.");
    this.elements.statusText.textContent = "⚠️ الصوت مش شغال دلوقتي — اقرأ الرد من سجل المحادثات";
    this.setAppState('idle');
    
    // Auto-open history panel so user can read the response
    this.elements.historyPanel?.classList.add('open');
    
    // Clear the warning after a few seconds
    setTimeout(() => {
      if (this.currentState === 'idle') {
        this.elements.statusText.textContent = "🎤 اضغط على المعلم للتحدث (أو زر المسافة Space)";
      }
    }, 4000);
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
