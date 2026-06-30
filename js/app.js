// Main Application Controller for CorrectMe
import { Config } from './config.js?v=23';
import { Avatar } from './avatar.js?v=23';
import { AudioEngine } from './audio.js?v=23';
import { sendChatMessage, geminiTTS } from './api.js?v=23';

class AppController {
  constructor() {
    this.avatar = null;
    this.audio = null;
    this.history = [];
    this.currentState = 'idle'; // idle, listening, thinking, speaking
    this.spacePressed = false;

    // Cache DOM Elements
    this.elements = {
      avatarContainer: document.querySelector('.avatar-container'),
      canvas: document.getElementById('avatar-canvas'),
      statusText: document.getElementById('status-text'),
      interimText: document.getElementById('interim-text'),
      historyContainer: document.getElementById('history-container'),
      historyPanel: document.getElementById('history-panel'),
      toggleHistoryBtn: document.getElementById('toggle-history-btn')
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
    this.setAppState('idle');

    // 5. Sarcastic Welcome greeting (with variety and autoplay bypass)
    const greetings = [
      "أهلاً يا فصيح! أنا المعلم الساخر بتاعك النهاردة. يلا وريني إنجليزيتك العبقرية... لو عندك أصلاً! اضغط على صورتي عشان نبدأ الهبد.",
      "يا هلا بالجهبذ! جاي تصحح الإنجليزي بتاعك عندي؟ ماشي، اتكلم وسمعني عبقريتك... بس ما تعيطش في الآخر! اضغط على الأفاتار وابدأ.",
      "مين ده؟ بشير الخير؟ جاي تقولي آي إز هابي وتجلطني؟ اتفضل اضغط على صورتي وسمعني الكوارث اللغوية بتاعتك.",
      "أهلاً بعبقري جيلك! مستني إيه؟ اضغط على الأفاتار وسمعني الإنجليزي اللي جايبه من سوق الجمعة.",
      "يا مرحب باللي جاي يضيع وقتي! اتكلم واخلص ووريني هتقول إيه النهاردة في الآيلتس بتاعك ده... اضغط على صورتي."
    ];
    const welcomeText = greetings[Math.floor(Math.random() * greetings.length)];
    this.history.push({ role: 'model', content: welcomeText });
    this.addMessageToPanel('model', welcomeText);

    let spoken = false;
    const triggerWelcomeSpeech = async () => {
      if (spoken) return;
      spoken = true;
      
      // Cleanup event listeners
      document.removeEventListener('click', triggerWelcomeSpeech);
      document.removeEventListener('keydown', triggerWelcomeSpeech);
      
      await this.speakWithGeminiTTS(welcomeText);
    };

    // Listen for any user interaction to bypass autoplay restrictions
    document.addEventListener('click', triggerWelcomeSpeech);
    document.addEventListener('keydown', triggerWelcomeSpeech);
  }

  bindEvents() {
    // Click Toggle Mode for Avatar
    this.elements.avatarContainer.addEventListener('click', () => this.toggleMic());

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

    // Do not fall back to Web Speech API to prevent robotic Microsoft voices
    console.warn("All TTS engines failed. Suppressed Web Speech API fallback to avoid robotic voices.");
    this.elements.statusText.textContent = "فشل تشغيل الصوت الطبيعي حالياً (ضغط على السيرفر)، تقدر تقرأ الرد من الشات الجانبي! 📖";
    this.setAppState('idle');
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
