// Pure aggregation over a session's turns - no LLM calls in here, so it's
// cheap to recompute any time.

function avg(nums) {
  if (!nums.length) return 0;
  return Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2));
}

function summarizeSession(session) {
  const turns = session.turns || [];
  const technicalScores = turns.map((t) => t.evaluation.technicalScore);
  const communicationScores = turns.map((t) => t.evaluation.communicationScore);
  const confidenceScores = turns.map((t) => t.evaluation.confidenceScore);

  const correctCount = turns.filter((t) => t.evaluation.correctness === 'correct').length;
  const partialCount = turns.filter((t) => t.evaluation.correctness === 'partially_correct').length;
  const incorrectCount = turns.filter((t) => t.evaluation.correctness === 'incorrect').length;

  const totalFillerWords = turns.reduce((sum, t) => sum + (t.fillerStats?.totalFillerWords || 0), 0);
  const avgFillerRate = avg(turns.map((t) => t.fillerStats?.fillerRate || 0));

  // Aggregate recurring communication issues and missing concepts across the session
  const issueCounts = {};
  const missingConceptCounts = {};
  for (const t of turns) {
    for (const issue of t.evaluation.communicationIssues || []) {
      issueCounts[issue] = (issueCounts[issue] || 0) + 1;
    }
    for (const concept of t.evaluation.missingConcepts || []) {
      missingConceptCounts[concept] = (missingConceptCounts[concept] || 0) + 1;
    }
  }
  const topIssues = Object.entries(issueCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([issue, count]) => ({ issue, count }));
  const topMissingConcepts = Object.entries(missingConceptCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([concept, count]) => ({ concept, count }));

  const overallScore = avg([
    avg(technicalScores),
    avg(communicationScores),
    avg(confidenceScores),
  ]);

  return {
    id: session.id,
    category: session.category,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    status: session.status,
    questionCount: turns.length,
    overallScore,
    avgTechnicalScore: avg(technicalScores),
    avgCommunicationScore: avg(communicationScores),
    avgConfidenceScore: avg(confidenceScores),
    correctCount,
    partialCount,
    incorrectCount,
    totalFillerWords,
    avgFillerRate,
    topIssues,
    topMissingConcepts,
  };
}

/** Picks a few bank questions likely to be useful next time: categories/
 * difficulties tied to this session's weak spots, excluding anything asked
 * correctly and confidently already. */
function recommendNextQuestions(session, allQuestions) {
  const turns = session.turns || [];
  const weakCategories = new Set();
  const askedIds = new Set();
  for (const t of turns) {
    if (t.questionId) askedIds.add(t.questionId);
    if (t.evaluation.correctness !== 'correct' || t.evaluation.technicalScore < 7) {
      weakCategories.add(t.category);
    }
  }
  const candidates = allQuestions.filter(
    (q) => weakCategories.has(q.category) && !askedIds.has(q.id)
  );
  const pool = candidates.length ? candidates : allQuestions.filter((q) => !askedIds.has(q.id));
  // Shuffle and take up to 5
  return pool
    .map((q) => ({ q, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .slice(0, 5)
    .map(({ q }) => ({ id: q.id, question: q.question, category: q.category, difficulty: q.difficulty }));
}

module.exports = { summarizeSession, recommendNextQuestions };
