const text = "إيه يا عم؟ هو اللسان اتقطع ولا إيه؟ صباح النور يا حمار، دي قاعدة ابتدائية!\n\nلما بتتكلم عن حاجة بتحصل في الصبح عموماً، لازم تحط 'the' قبل 'morning'. مش بتقول 'في صباح'، بتقول 'في الصباح'. زيها زي 'in the afternoon' و 'in the evening'.\n\nالجملة الصح هي:\n**I really like coffee in the morning.**\n\nيلا يا فهلوي، عيد الجملة دي صح عشان أصدق إنك فهمت، ولا أقولك؟ قول لي بقى إيه المشروب اللي بتحبه في المساء؟";

let formattedText = text
  .replace(/\n/g, '<br>')
  .replace(/"([^"]*[a-zA-Z]+[^"]*)"/g, '<span class="correction-highlight">"$1"</span>')
  .replace(/'([^']*[a-zA-Z]+[^']*)'/g, '<span class="correction-highlight">\'$1\'</span>');

console.log("Formatted:");
console.log(formattedText);
