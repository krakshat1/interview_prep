const express = require('express');
const { nanoid } = require('nanoid');
const store = require('../services/store');
const { evaluateAnswer, generateCoachSummary } = require('../services/aiClient');
const { analyzeFillers } = require('../services/filler');
const { pickNextQuestion, adjustDifficulty } = require('../services/questionSelector');
const { summarizeSession, recommendNextQuestions } = require('../services/report');
const mastery = require('../services/mastery');

const router = express.Router();

const MAX_FOLLOW_UP_DEPTH = 1; // how many follow-ups deep we'll chain before forcing a fresh bank question

function pendingFromBankQuestion(q, difficulty) {
  return {
    source: 'bank',
    questionId: q.id,
    questionText: q.question,
    category: q.category,
    difficulty: q.difficulty,
    refQuestion: q,
    followUpDepth: 0,
  };
}

// POST /api/interview/start  { category, difficulty }
router.post('/start', (req, res) => {
  try {
    const { category, difficulty } = req.body;
    const questions = [...store.getQuestions(), ...store.getUserQuestions(req.user.id)];
    if (!questions.length) {
      return res.status(400).json({ error: 'Question bank is empty. Add some questions first.' });
    }
    const startDifficulty = difficulty || 'Intermediate';
    const first = pickNextQuestion({ questions, category, difficulty: startDifficulty, excludeIds: [] });
    if (!first) {
      return res.status(400).json({ error: 'No questions match that category/difficulty.' });
    }

    const session = {
      id: nanoid(10),
      category: category || 'Mixed',
      startDifficulty,
      currentDifficulty: startDifficulty,
      startedAt: new Date().toISOString(),
      endedAt: null,
      status: 'in_progress',
      turns: [],
      askedQuestionIds: [],
      pending: pendingFromBankQuestion(first, startDifficulty),
    };

    store.saveSession(req.user.id, session);
    store.addOrUpdateSessionSummary(req.user.id, summarizeSession(session));

    res.status(201).json({
      sessionId: session.id,
      question: {
        text: session.pending.questionText,
        category: session.pending.category,
        difficulty: session.pending.difficulty,
        isFollowUp: false,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/interview/:id - full session detail
router.get('/:id', (req, res) => {
  const session = store.getSession(req.user.id, req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

// POST /api/interview/:id/submit  { transcript }
router.post('/:id/submit', async (req, res) => {
  try {
    const session = store.getSession(req.user.id, req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'in_progress' || !session.pending) {
      return res.status(400).json({ error: 'This session has no pending question.' });
    }

    const transcript = (req.body.transcript || '').trim();
    const pending = session.pending;
    const fillerStats = analyzeFillers(transcript);

    const questionForEval = pending.refQuestion || {
      question: pending.questionText,
      category: pending.category,
      difficulty: pending.difficulty,
    };

    const evaluation = await evaluateAnswer({
      question: questionForEval,
      transcript,
      fillerStats,
    });

    const turn = {
      questionId: pending.questionId || null,
      question: pending.questionText,
      category: pending.category,
      difficulty: pending.difficulty,
      isFollowUp: pending.source === 'followup',
      transcript,
      fillerStats,
      evaluation,
      submittedAt: new Date().toISOString(),
    };
    session.turns.push(turn);
    if (pending.questionId) session.askedQuestionIds.push(pending.questionId);

    session.currentDifficulty = adjustDifficulty(session.currentDifficulty, evaluation.difficultyAdjustment);
    mastery.recordAttempt(req.user.id, pending.category, evaluation);

    // Decide what happens next
    let next;
    const canFollowUp =
      evaluation.followUp &&
      evaluation.followUp.shouldAskFollowUp &&
      evaluation.followUp.question &&
      pending.followUpDepth < MAX_FOLLOW_UP_DEPTH;

    if (canFollowUp) {
      session.pending = {
        source: 'followup',
        questionId: null,
        questionText: evaluation.followUp.question,
        category: pending.category,
        difficulty: session.currentDifficulty,
        refQuestion: null,
        followUpDepth: pending.followUpDepth + 1,
      };
      next = {
        type: 'follow_up',
        question: {
          text: session.pending.questionText,
          category: session.pending.category,
          difficulty: session.pending.difficulty,
          isFollowUp: true,
        },
      };
    } else {
      const questions = [...store.getQuestions(), ...store.getUserQuestions(req.user.id)];
      const nextQ = pickNextQuestion({
        questions,
        category: session.category,
        difficulty: session.currentDifficulty,
        excludeIds: session.askedQuestionIds,
      });
      if (nextQ) {
        session.pending = pendingFromBankQuestion(nextQ, session.currentDifficulty);
        next = {
          type: 'next_question',
          question: {
            text: session.pending.questionText,
            category: session.pending.category,
            difficulty: session.pending.difficulty,
            isFollowUp: false,
          },
        };
      } else {
        session.pending = null;
        session.status = 'completed';
        session.endedAt = new Date().toISOString();
        next = { type: 'session_complete' };
      }
    }

    store.saveSession(req.user.id, session);
    store.addOrUpdateSessionSummary(req.user.id, summarizeSession(session));

    res.json({ evaluation, fillerStats, next });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/interview/:id/end - end the session early (user-initiated)
router.post('/:id/end', async (req, res) => {
  try {
    const session = store.getSession(req.user.id, req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'completed') {
      session.status = 'completed';
      session.endedAt = new Date().toISOString();
      session.pending = null;
      store.saveSession(req.user.id, session);
    }
    const summary = summarizeSession(session);
    store.addOrUpdateSessionSummary(req.user.id, summary);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/interview/:id/report - full report incl. LLM coach summary + recommended next questions
router.get('/:id/report', async (req, res) => {
  try {
    const session = store.getSession(req.user.id, req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const summary = summarizeSession(session);
    const questions = [...store.getQuestions(), ...store.getUserQuestions(req.user.id)];
    const recommendedNext = recommendNextQuestions(session, questions);

    let coachSummary = session.coachSummary;
    if (!coachSummary && session.turns.length > 0) {
      try {
        coachSummary = await generateCoachSummary({ ...summary, recommendedNext });
        session.coachSummary = coachSummary;
        store.saveSession(req.user.id, session);
      } catch (e) {
        coachSummary = null; // don't fail the whole report if the LLM call fails
      }
    }

    res.json({
      summary,
      coachSummary,
      recommendedNext,
      turns: session.turns,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
