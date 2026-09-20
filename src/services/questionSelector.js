const DIFFICULTY_ORDER = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];

function clampDifficulty(index) {
  return Math.max(0, Math.min(DIFFICULTY_ORDER.length - 1, index));
}

function adjustDifficulty(currentDifficulty, adjustment) {
  const idx = DIFFICULTY_ORDER.indexOf(currentDifficulty);
  const base = idx === -1 ? 1 : idx;
  if (adjustment === 'increase') return DIFFICULTY_ORDER[clampDifficulty(base + 1)];
  if (adjustment === 'decrease') return DIFFICULTY_ORDER[clampDifficulty(base - 1)];
  return DIFFICULTY_ORDER[clampDifficulty(base)];
}

/**
 * Picks the next question from the bank.
 * - Respects the requested category (or any category if 'Mixed'/falsy).
 * - Prefers unused questions at the current target difficulty.
 * - Falls back to progressively looser constraints so a session doesn't
 *   dead-end just because one difficulty bucket is empty.
 */
function pickNextQuestion({ questions, category, difficulty, excludeIds = [] }) {
  const excluded = new Set(excludeIds);
  const inCategory = (q) => !category || category === 'Mixed' || q.category === category;
  const unused = (q) => !excluded.has(q.id);

  const tryFilters = [
    (q) => inCategory(q) && unused(q) && q.difficulty === difficulty,
    (q) => inCategory(q) && unused(q), // any difficulty in category
    (q) => unused(q), // any category, any difficulty
    (q) => true, // allow repeats as a last resort
  ];

  for (const filter of tryFilters) {
    const candidates = questions.filter(filter);
    if (candidates.length > 0) {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
  }
  return null; // empty bank entirely
}

module.exports = { DIFFICULTY_ORDER, adjustDifficulty, pickNextQuestion };
