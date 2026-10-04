// Study Mode: a chat-based AI tutor built on the same question bank as the
// mock interview, but for learning rather than grading - see aiClient.js's
// tutorRespond() for the actual coaching logic. Deliberately stateless on
// the server (the client holds the conversation array and resends it each
// turn) - there's no multi-device/resume-later need here, so a session file
// would be plumbing without a payoff.
const express = require('express');
const store = require('../services/store');
const { tutorRespond } = require('../services/aiClient');
const { analyzeFillers } = require('../services/filler');
const { pickNextQuestion } = require('../services/questionSelector');
const mastery = require('../services/mastery');

const router = express.Router();

function allQuestions(userId) {
  return [...store.getQuestions(), ...store.getUserQuestions(userId)];
}

// Maps the tutor's plain-language concept read into the same shape
// mastery.recordAttempt() already expects from interview evaluations.
const CONCEPT_TO_EVALUATION = {
  nailed_it: { technicalScore: 9, correctness: 'correct' },
  close: { technicalScore: 6, correctness: 'partially_correct' },
  needs_work: { technicalScore: 3, correctness: 'incorrect' },
};

// POST /api/study/next  { category, difficulty, excludeIds }
router.post('/next', (req, res) => {
  try {
    const { category, difficulty, excludeIds } = req.body || {};
    const questions = allQuestions(req.user.id);
    if (!questions.length) {
      return res.status(400).json({ error: 'Question bank is empty. Add some questions first.' });
    }
    const picked = pickNextQuestion({
      questions,
      category,
      difficulty: difficulty || 'Beginner',
      excludeIds: excludeIds || [],
    });
    if (!picked) return res.status(400).json({ error: 'No questions match that category/difficulty.' });

    res.json({
      question: {
        id: picked.id,
        text: picked.question,
        category: picked.category,
        difficulty: picked.difficulty,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/study/message  { questionId, conversation, message }
router.post('/message', async (req, res) => {
  try {
    const { questionId, conversation, message, currentStage } = req.body || {};
    const question = allQuestions(req.user.id).find((q) => q.id === questionId);
    if (!question) return res.status(404).json({ error: 'Question not found.' });

    const trimmed = (message || '').trim();
    const fillerStats = analyzeFillers(trimmed);

    const tutorTurn = await tutorRespond({
      question,
      conversation: Array.isArray(conversation) ? conversation : [],
      message: trimmed,
      fillerStats,
      currentStage: currentStage || null,
    });

    if (tutorTurn.wasGenuineAttempt) {
      const mapped = CONCEPT_TO_EVALUATION[tutorTurn.conceptFeedback.status];
      if (mapped) mastery.recordAttempt(req.user.id, question.category, mapped);
    }

    res.json({ tutorTurn, fillerStats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
