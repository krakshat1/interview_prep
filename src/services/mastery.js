// Lightweight spaced-repetition + readiness tracking, keyed by question-bank
// / practice category (e.g. "Python", "SQL", "Machine Learning"). This is a
// simplified Leitner system: each category sits in a "box" 0-5; a strong
// attempt promotes it, a weak one demotes it (harder than it promotes, so
// weak spots resurface fast), and the review interval grows with the box.

const store = require('./store');

const BOX_INTERVAL_DAYS = [0, 1, 3, 7, 14, 30]; // index = box level

function statusForBox(box, attempts) {
  if (attempts === 0) return 'new';
  if (box === 0) return 'weak';
  if (box >= 4) return 'mastered';
  return 'learning';
}

function scoreToBoxDelta(evaluation) {
  // evaluation: { technicalScore, correctness } (or just a 0-10 score for
  // non-interview submissions like code/SQL practice)
  const score = evaluation.technicalScore ?? evaluation.score ?? 0;
  const correctness = evaluation.correctness;
  if (correctness === 'incorrect' || score < 4) return -2;
  if (correctness === 'partially_correct' || (score >= 4 && score < 7)) return 0;
  return +1; // correct / score >= 7
}

function addDays(iso, days) {
  const d = iso ? new Date(iso) : new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/**
 * Records one attempt (an interview answer or a practice submission) against
 * a category and returns the updated mastery entry for it.
 */
function recordAttempt(userId, category, evaluation) {
  const mastery = store.getMastery(userId);
  const entry = mastery[category] || {
    category,
    box: 0,
    attempts: 0,
    correctStreak: 0,
    history: [],
    lastAttemptAt: null,
    nextReviewAt: null,
  };

  const delta = scoreToBoxDelta(evaluation);
  entry.box = Math.max(0, Math.min(5, entry.box + delta));
  entry.attempts += 1;
  entry.correctStreak = delta > 0 ? entry.correctStreak + 1 : 0;
  entry.lastScore = evaluation.technicalScore ?? evaluation.score ?? null;
  entry.lastAttemptAt = new Date().toISOString();
  entry.nextReviewAt = addDays(entry.lastAttemptAt, BOX_INTERVAL_DAYS[entry.box]);
  entry.status = statusForBox(entry.box, entry.attempts);
  entry.history.push({
    date: entry.lastAttemptAt,
    score: entry.lastScore,
    correctness: evaluation.correctness || null,
    box: entry.box,
  });
  if (entry.history.length > 50) entry.history = entry.history.slice(-50); // cap growth

  mastery[category] = entry;
  store.saveMastery(userId, mastery);
  return entry;
}

/** Categories whose next review date has passed (or were never mastered). */
function getDueForReview(userId) {
  const mastery = store.getMastery(userId);
  const now = new Date();
  return Object.values(mastery)
    .filter((e) => e.status === 'weak' || (e.nextReviewAt && new Date(e.nextReviewAt) <= now))
    .sort((a, b) => (a.status === 'weak' ? -1 : 1) - (b.status === 'weak' ? -1 : 1));
}

// Maps question-bank / practice categories into the section-31 skill areas.
// Anything not listed here still gets tracked in mastery.json but won't
// appear in the headline readiness breakdown.
const SKILL_AREA_MAP = {
  Python: 'Python',
  SQL: 'SQL',
  'Data Analysis': 'Data Analysis',
  'Math - Linear Algebra': 'Math & Statistics',
  'Math - Calculus & Optimization': 'Math & Statistics',
  'Math - Probability & Statistics': 'Math & Statistics',
  'Math - Information Theory': 'Math & Statistics',
  'Machine Learning': 'Machine Learning',
  'Deep Learning': 'Deep Learning',
  'Generative AI / LLMs': 'LLM / AI Engineering',
  MLOps: 'MLOps',
  'Coding & DSA': 'Coding & Problem Solving',
  'System Design': 'System Design',
  'Behavioral/HR': 'Behavioral Interviews',
};

function boxToPercent(box) {
  return Math.round((box / 5) * 100);
}

/**
 * Computes the section-31-style readiness breakdown: a percentage per skill
 * area (averaged across every category that maps to it), plus an overall
 * average. Categories never attempted default to 0%, which is deliberate -
 * "not started" should read as not-ready, not be silently excluded.
 */
function getReadiness(userId) {
  const mastery = store.getMastery(userId);
  const byArea = {};
  for (const [category, skillArea] of Object.entries(SKILL_AREA_MAP)) {
    if (!byArea[skillArea]) byArea[skillArea] = [];
    const entry = mastery[category];
    byArea[skillArea].push(entry ? boxToPercent(entry.box) : 0);
  }
  const breakdown = {};
  for (const [area, values] of Object.entries(byArea)) {
    breakdown[area] = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  }
  const overall = Math.round(
    Object.values(breakdown).reduce((a, b) => a + b, 0) / Math.max(1, Object.values(breakdown).length)
  );
  return { overall, breakdown, raw: mastery };
}

module.exports = { recordAttempt, getDueForReview, getReadiness, SKILL_AREA_MAP, BOX_INTERVAL_DAYS };
