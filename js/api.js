// Gemini API Integration for CorrectMe
import { Config } from './config.js?v=36';

const SYSTEM_PROMPT = `أنت معلم IELTS مصري، لسانك طويل جداً، ساخر لدرجة الاستفزاز، وبتعامل الطالب كأنه بهيم مبيفهمش حاجة في الإنجليزي. بتتكلم بالعامية المصرية الدارجة والشعبية في الشارع المصري.

شخصيتك وسلوكك:
1. لما المستخدم يغلط غلطة في الإنجليزي (حتى لو غلطة صغيرة):
   - لازم تهزقه وتشتمه وتتريق عليه بشتائم ومصطلحات مصرية كوميدية ولكن لاذعة وحادة جداً.
   - استخدم مصطلحات زي: "يا بهيم"، "يا لوح"، "يا جحش"، "إيه القرف ده؟"، "الله يخرب بيت سنينك"، "إنت كنت بتتعلم إنجليزي في زريبة مواشي؟"، "ده إنجليزي ده ولا طلاسم سحر أسود؟"، "أنا لو منك أروح أبيع ترمس أكرملي"، "يا فصيح زمانك اللي مبيجمعش جملة".
2. طريقة ردك وتصحيحك لازم تكون بالترتيب ده بالظبط وبنبرة عالية الاستهزاء:
   أولاً: تبدأ بالتهزيق والشتيمة الساخرة والتريقة الشديدة على الجملة اللي قالها (جملتين تلاتة يجلطوه).
   ثانياً: تشرح الغلطة اللي عملها بالعامية المصرية بأسلوب تهكمي (مثال: "بقى بذمتك في حد في الدنيا يقول كذا؟").
   ثالثاً: تديله التصحيح بالإنجليزي بطريقة واضحة (اكتب الجملة الصح كاملة).
   رابعاً: تسخر منه تاني وتقوله يعيد الجملة الصح دي أو تسأله سؤال عشان يغلط وتتريق عليه تاني.

مثال للرد لو قال "I is happy":
"يا بهيم! I is happy؟ الله يخرب بيت سنينك ده إنجليزي ده ولا لغة الفراعنة؟ 'I' بتاخد 'am' يا عبقري زمانك مش 'is'! جلطتني وجبتلي شلل رعاش!
الجملة الصح يا لوح هي: 'I am happy'.
انطقها صح بقى وسمعني عبقريتك عشان أصدق إنك فهمت، ولا شكلك ميئوس منك؟"

لو كلامه صح 100% ومفيش أي أخطاء:
امدحه بطريقة ساخرة برضو وحسسه إنه عمل إنجاز تاريخي بالصدفة (مثال: "والله وطلعت بتعرف تتكلم إنجليزي يا إسكندر! أنا مصدوم! شكل الحظ لعب معاك المرة دي")، وسأله سؤال IELTS جديد عشان يغلط فيه وتلاقيلك فرصة تهزقه تاني.

مهم جداً:
- خلي ردك كله قصير ومختصر عشان الـ Text-to-Speech ينطقه بسرعة (أقل من 80 كلمة).
- الكلام والشرح والتريقة يكون بالعامية المصرية، والتصحيح والسؤال الجديد هما بس اللي بالإنجليزي.
- ركز على أخطاء القواعد (Grammar) والنطق (Pronunciation/Word Choice) والـ IELTS criteria.`;

export async function sendChatMessage(history) {
  const apiKey = Config.getApiKey();
  if (!apiKey) {
    throw new Error("API Key غير موجود. برجاء إدخاله في الإعدادات أولاً.");
  }

  // Format history for Gemini API.
  const formattedContents = [];
  const recentHistory = history.slice(-8);
  
  recentHistory.forEach(msg => {
    formattedContents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    });
  });

  // Try multiple models in sequence if one is overloaded (503) or rate limited (429)
  const models = [
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash'
  ];
  let lastError = null;

  for (let idx = 0; idx < models.length; idx++) {
    const model = models[idx];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    console.log(`Trying Gemini request with model: ${model}`);
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: formattedContents,
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }]
          },
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 1024,
            topP: 0.95
          }
        })
      });

      // Handlers for retryable statuses
      if (response.status === 404) {
        console.warn(`Model ${model} not found (404). Trying next...`);
        lastError = new Error(`النموذج ${model} غير متوفر.`);
        continue;
      }

      if (response.status === 429 || response.status === 503 || response.status === 500) {
        const errorData = await response.json().catch(() => ({}));
        const errMsg = errorData.error?.message || response.statusText;
        console.warn(`Model ${model} failed with status ${response.status} (${errMsg}). Trying fallback model...`);
        lastError = new Error(errMsg);
        continue;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `خطأ ${response.status}`);
      }

      const data = await response.json();
      const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!candidateText) {
        throw new Error("لم يتم استلام رد صحيح من النموذج.");
      }

      return candidateText; // Successful request!
    } catch (error) {
      console.error(`Gemini request failed for model ${model}:`, error);
      lastError = error;
    }
  }

  // All models failed
  throw new Error(lastError ? lastError.message : "فشلت جميع نماذج Gemini في الرد. حاول مرة أخرى.");
}

/**
 * Gemini TTS — Convert text to speech using Gemini's built-in TTS model.
 * Returns a Blob of WAV audio, or null if TTS fails.
 * Uses gemini-2.5-flash-preview-tts which is FREE and produces human-quality speech.
 */
export async function geminiTTS(text) {
  const apiKey = Config.getApiKey();
  if (!apiKey) return null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Orus" // Warm, expressive male voice — great for sarcastic Egyptian teacher
              }
            }
          }
        }
      })
    });

    if (!response.ok) {
      console.warn("Gemini TTS request failed:", response.status);
      return null;
    }

    const data = await response.json();
    const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!inlineData || !inlineData.data) {
      console.warn("Gemini TTS returned no audio data");
      return null;
    }

    // Decode base64 PCM data and wrap it in a WAV container
    const pcmBase64 = inlineData.data;
    const pcmBytes = Uint8Array.from(atob(pcmBase64), c => c.charCodeAt(0));

    // Build WAV header for: 24000 Hz, 16-bit, mono PCM
    const sampleRate = 24000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = pcmBytes.length;
    const headerSize = 44;
    const buffer = new ArrayBuffer(headerSize + dataSize);
    const view = new DataView(buffer);

    // RIFF header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    // fmt sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);          // SubChunk1Size (PCM)
    view.setUint16(20, 1, true);           // AudioFormat (PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    // data sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Copy PCM data
    const wavBytes = new Uint8Array(buffer);
    wavBytes.set(pcmBytes, headerSize);

    return new Blob([wavBytes], { type: 'audio/wav' });
  } catch (err) {
    console.error("Gemini TTS error:", err);
    return null;
  }
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Generates a completely dynamic sarcastic welcome greeting using Gemini.
 */
export async function generateWelcomeGreeting() {
  const apiKey = Config.getApiKey();
  if (!apiKey) return "يا هلا بالجهبذ! اضغط على صورتي وسمعني الإنجليزي بتاعك.";

  const prompt = "أنت معلم لغة إنجليزية مصري ساخر، خفيف الظل، بتصحح أخطاء الناس بطريقة كوميدية فيها تريقة وهزار مصري. اكتب جملة ترحيبية قصيرة جداً (لا تزيد عن 20 كلمة) ترحب باللي فاتح الموقع عشان يتعلم إنجليزي وتتحداه أو تتريق عليه بأسلوب مصري كوميدي وتقوله يضغط على صورتي (الأفاتار) عشان يبدأ يتكلم معاك. اكتب الجملة بالعامية المصرية الساخرة وبدون أي تشكيل وبدون مقدمات، ادخل في الجملة الترحيبية مباشرة.";

  const models = [
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash'
  ];

  for (let idx = 0; idx < models.length; idx++) {
    const model = models[idx];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 150,
            topP: 0.95
          }
        })
      });

      if (!response.ok) continue;

      const data = await response.json();
      const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (candidateText) {
        return candidateText.trim();
      }
    } catch (error) {
      console.error(`Greeting generation failed for model ${model}:`, error);
    }
  }
  return "يا هلا بالجهبذ! اضغط على صورتي وسمعني الإنجليزي بتاعك.";
}


