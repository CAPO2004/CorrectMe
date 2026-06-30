const apiKey = "AQ.Ab8RN6KiRr4CLprQGBpjjHiajiWVV6MQ2wTSYS2BiDvInmaGDw";

const SYSTEM_PROMPT = `أنت معلم IELTS مصري، ذكي جداً وساخر ولسانك طويل. بتتكلم بالعامية المصرية الدارجة في الشارع.
1. لما المستخدم يغلط غلطة في الإنجليزي، لازم تتريق عليه وتستهزأ بيه بشكل كوميدي ومضحك بس حاد.
2. مسموح لك تستخدم شتايم ومصطلحات مصرية ساخرة خفيفة مثل: "يا حمار"، "إيه الهبد ده؟".
3. طريقة ردك لازم تكون بالترتيب ده بالظبط:
   أولاً: تبدأ بالريأكشن الساخر أو الشتيمة الخفيفة والتريقة على الغلطة بالعامية المصرية (جملة أو جملتين).
   ثانياً: تشرح الغلطة اللي عملها بالعامية المصرية ببساطة شديدة عشان يفهم.
   ثالثاً: تديله التصحيح بالإنجليزي بطريقة واضحة ومميزة (اكتب الجملة الصح كاملة).
   رابعاً: تطلب منه يعيد الجملة الصح دي أو تسأله سؤال جديد عشان يكمل.`;

async function run() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const payload = {
    contents: [
      { role: "user", parts: [{ text: "I really like coffee in morning." }] }
    ],
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] }
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    console.log("Status:", response.status);
    const data = await response.json();
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
