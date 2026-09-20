// Deterministic filler-word / hedge-phrase detection, run locally on the
// transcript rather than trusting the LLM to count accurately.

const FILLER_PATTERNS = [
  { label: 'um', re: /\bum+\b/gi },
  { label: 'uh', re: /\buh+\b/gi },
  { label: 'ah', re: /\bah+\b/gi },
  { label: 'like', re: /\blike\b/gi },
  { label: 'actually', re: /\bactually\b/gi },
  { label: 'basically', re: /\bbasically\b/gi },
  { label: 'literally', re: /\bliterally\b/gi },
  { label: 'you know', re: /\byou know\b/gi },
  { label: 'i mean', re: /\bi mean\b/gi },
  { label: 'sort of', re: /\bsort of\b/gi },
  { label: 'kind of', re: /\bkind of\b/gi },
  { label: 'so yeah', re: /\bso yeah\b/gi },
  { label: 'right?', re: /\bright\?/gi },
  { label: 'okay so', re: /\bokay so\b/gi },
];

function analyzeFillers(transcript) {
  const text = transcript || '';
  const words = text.trim().length ? text.trim().split(/\s+/) : [];
  const breakdown = {};
  let total = 0;

  for (const { label, re } of FILLER_PATTERNS) {
    const matches = text.match(re);
    if (matches && matches.length) {
      breakdown[label] = matches.length;
      total += matches.length;
    }
  }

  const wordCount = words.length;
  const fillerRate = wordCount > 0 ? total / wordCount : 0;

  return {
    totalFillerWords: total,
    wordCount,
    fillerRate: Number(fillerRate.toFixed(3)), // fraction of words that were fillers
    breakdown,
  };
}

module.exports = { analyzeFillers };
