const express = require('express');
const { analyzeJobDescription } = require('../services/aiClient');
const mastery = require('../services/mastery');

const router = express.Router();

// POST /api/jobmatch/analyze { jobDescriptionText }
// Compares a pasted job description against the candidate's *measured*
// skill levels (from mastery.json, not self-reported) - section 27.
router.post('/analyze', async (req, res) => {
  try {
    const jobDescriptionText = (req.body.jobDescriptionText || '').trim();
    if (jobDescriptionText.length < 30) {
      return res.status(400).json({ error: 'Paste the job description text (at least a few sentences).' });
    }

    const readiness = mastery.getReadiness(req.user.id);
    const analysis = await analyzeJobDescription({
      jobDescriptionText,
      readinessBreakdown: readiness.breakdown,
    });

    res.json(analysis);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
