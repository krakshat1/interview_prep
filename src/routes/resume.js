const express = require('express');
const { nanoid } = require('nanoid');
const store = require('../services/store');
const { generateResumeQuestions } = require('../services/aiClient');

const router = express.Router();

// POST /api/resume/questions { resumeText }
// Generates "defend your resume" questions (section 26) and adds them into
// the main question bank under category "Resume-Based" so they flow through
// the existing mock-interview engine like any other question. Also saves
// the resume text onto the profile for reuse.
router.post('/questions', async (req, res) => {
  try {
    const resumeText = (req.body.resumeText || '').trim();
    if (resumeText.length < 50) {
      return res.status(400).json({ error: 'Paste your full resume text (at least a few sentences).' });
    }

    const generated = await generateResumeQuestions(resumeText);

    const personalQuestions = store.getUserQuestions(req.user.id);
    const newQuestions = generated.map((q) => ({
      id: `resume-${nanoid(8)}`,
      category: 'Resume-Based',
      difficulty: q.difficulty,
      question: q.question,
      expectedAnswer: `This should be answered from your own real experience - the interviewer is probing: ${q.relatedClaim}`,
      keyConcepts: q.whatAGoodAnswerCovers,
      followUpQuestions: [],
      commonMistakes: ['Giving a vague or rehearsed answer instead of a specific, concrete detail from what you actually did'],
    }));
    store.saveUserQuestions(req.user.id, [...personalQuestions, ...newQuestions]);

    const profile = store.getProfile(req.user.id);
    if (profile) {
      profile.resumeText = resumeText;
      profile.updatedAt = new Date().toISOString();
      store.saveProfile(req.user.id, profile);
    }

    res.status(201).json({ questions: newQuestions, count: newQuestions.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
