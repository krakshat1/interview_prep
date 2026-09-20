const express = require('express');
const store = require('../services/store');

const router = express.Router();

// GET /api/reports - session history list, sorted newest first
router.get('/', (req, res) => {
  const index = store.getSessionIndex(req.user.id);
  const sorted = [...index]
    .filter((s) => s.status === 'completed' || s.questionCount > 0)
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  res.json(sorted);
});

// GET /api/reports/trend - time series of scores for charting progress over sessions
router.get('/trend', (req, res) => {
  const index = store.getSessionIndex(req.user.id);
  const sorted = [...index]
    .filter((s) => s.questionCount > 0)
    .sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));
  res.json(
    sorted.map((s) => ({
      id: s.id,
      startedAt: s.startedAt,
      category: s.category,
      overallScore: s.overallScore,
      avgTechnicalScore: s.avgTechnicalScore,
      avgCommunicationScore: s.avgCommunicationScore,
      avgConfidenceScore: s.avgConfidenceScore,
      avgFillerRate: s.avgFillerRate,
    }))
  );
});

module.exports = router;
