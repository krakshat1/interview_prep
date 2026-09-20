const express = require('express');
const store = require('../services/store');
const mastery = require('../services/mastery');

const router = express.Router();

// GET /api/dashboard - readiness score breakdown + due-for-review topics +
// recent activity. This is the section-31 "Final Interview Readiness" view,
// computed live from mastery.json rather than a one-time self-report.
router.get('/', (req, res) => {
  const readiness = mastery.getReadiness(req.user.id);
  const dueForReview = mastery.getDueForReview(req.user.id);
  const sessions = store.getSessionIndex(req.user.id)
    .filter((s) => s.questionCount > 0)
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));

  res.json({
    readiness,
    dueForReview,
    recentSessions: sessions.slice(0, 10),
    totalSessions: sessions.length,
  });
});

// GET /api/dashboard/weekly-report - section 29 format, computed from the
// last 7 days of session activity plus mastery deltas over that window.
router.get('/weekly-report', (req, res) => {
  const sessions = store.getSessionIndex(req.user.id).filter((s) => s.questionCount > 0);
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const thisWeek = sessions.filter((s) => new Date(s.startedAt) >= weekAgo);
  const questionCount = thisWeek.reduce((sum, s) => sum + s.questionCount, 0);
  const avg = (arr) => (arr.length ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2)) : 0);

  const issueCounts = {};
  const conceptCounts = {};
  for (const s of thisWeek) {
    for (const i of s.topIssues || []) issueCounts[i.issue] = (issueCounts[i.issue] || 0) + i.count;
    for (const c of s.topMissingConcepts || []) conceptCounts[c.concept] = (conceptCounts[c.concept] || 0) + c.count;
  }
  const repeatedMistakes = Object.entries(issueCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([issue, count]) => ({ issue, count }));
  const topicsToRevise = Object.entries(conceptCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([concept, count]) => ({ concept, count }));

  const mastery_ = mastery.getReadiness(req.user.id);
  const dueForReview = mastery.getDueForReview(req.user.id);

  const byCategory = {};
  for (const s of thisWeek) {
    byCategory[s.category] = (byCategory[s.category] || 0) + 1;
  }
  const strongest = Object.entries(mastery_.raw).sort((a, b) => b[1].box - a[1].box).slice(0, 3).map(([cat, e]) => ({ category: cat, box: e.box }));
  const weakest = Object.entries(mastery_.raw).sort((a, b) => a[1].box - b[1].box).slice(0, 3).map(([cat, e]) => ({ category: cat, box: e.box }));

  res.json({
    periodStart: weekAgo.toISOString().slice(0, 10),
    periodEnd: now.toISOString().slice(0, 10),
    sessionsCompleted: thisWeek.length,
    questionsAnswered: questionCount,
    technicalScore: avg(thisWeek.map((s) => s.avgTechnicalScore)),
    communicationScore: avg(thisWeek.map((s) => s.avgCommunicationScore)),
    confidenceScore: avg(thisWeek.map((s) => s.avgConfidenceScore)),
    overallScore: avg(thisWeek.map((s) => s.overallScore)),
    strongestAreas: strongest,
    weakestAreas: weakest,
    repeatedMistakes,
    topicsToRevise,
    dueForReviewNextWeek: dueForReview.map((e) => e.category),
    readinessOverall: mastery_.overall,
  });
});

module.exports = router;
