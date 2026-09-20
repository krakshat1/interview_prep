const express = require('express');
const { nanoid } = require('nanoid');
const store = require('../services/store');
const { evaluateSystemDesign } = require('../services/aiClient');
const mastery = require('../services/mastery');

const router = express.Router();

// Fields only revealed after the candidate submits their own design, same
// pattern as solutionNote/expectedQuery in the coding/SQL practice routes.
const HIDDEN_UNTIL_SUBMIT = ['referenceApproach', 'evaluationFocus'];

function stripHidden(problem) {
  const copy = { ...problem };
  for (const f of HIDDEN_UNTIL_SUBMIT) delete copy[f];
  return copy;
}

router.get('/', (req, res) => {
  const problems = store.getSystemDesignProblems();
  const { difficulty } = req.query;
  const filtered = difficulty ? problems.filter((p) => p.difficulty === difficulty) : problems;
  res.json(filtered.map(stripHidden));
});

router.get('/:id', (req, res) => {
  const problem = store.getSystemDesignProblems().find((p) => p.id === req.params.id);
  if (!problem) return res.status(404).json({ error: 'Problem not found' });
  res.json(stripHidden(problem));
});

router.post('/:id/submit', async (req, res) => {
  try {
    const problem = store.getSystemDesignProblems().find((p) => p.id === req.params.id);
    if (!problem) return res.status(404).json({ error: 'Problem not found' });

    const answerText = (req.body.answerText || '').trim();
    if (answerText.length < 50) {
      return res.status(400).json({ error: 'Write up your design in more detail (at least a few sentences) before submitting.' });
    }

    const review = await evaluateSystemDesign({ problem, answerText });

    const overall = Math.round(
      (review.requirementsScore + review.architectureScore + review.scalabilityScore + review.tradeoffsScore) / 4
    );
    const correctness = overall >= 7 ? 'correct' : overall >= 4 ? 'partially_correct' : 'incorrect';
    mastery.recordAttempt(req.user.id, 'System Design', { technicalScore: overall, correctness });

    const submission = {
      id: nanoid(10),
      type: 'systemdesign',
      problemId: problem.id,
      answerText,
      review,
      overallScore: overall,
      submittedAt: new Date().toISOString(),
    };
    store.savePracticeSubmission(req.user.id, submission);

    res.json({
      review,
      overallScore: overall,
      referenceApproach: problem.referenceApproach,
      solutionNote: problem.solutionNote,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
