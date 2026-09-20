const express = require('express');
const { nanoid } = require('nanoid');
const store = require('../services/store');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const REQUIRED_FIELDS = ['question', 'category', 'difficulty', 'expectedAnswer'];

function validate(body) {
  const missing = REQUIRED_FIELDS.filter((f) => !body[f] || !String(body[f]).trim());
  return missing;
}

// GET /api/questions?category=&difficulty= - full question bank (with
// answers/key concepts), admin-only. Everyone else only ever needs /meta
// (for the category dropdown) - mock interviews pick questions server-side,
// not through this endpoint.
router.get('/', requireAdmin, (req, res) => {
  const { category, difficulty } = req.query;
  let questions = store.getQuestions();
  if (category) questions = questions.filter((q) => q.category === category);
  if (difficulty) questions = questions.filter((q) => q.difficulty === difficulty);
  res.json(questions);
});

// GET /api/questions/meta - distinct categories/difficulties for building UI
// dropdowns. Includes the caller's own personal (e.g. resume-based)
// categories alongside the shared bank's, so a deep link like
// index.html?category=Resume-Based can actually select that category.
router.get('/meta', (req, res) => {
  const questions = [...store.getQuestions(), ...store.getUserQuestions(req.user.id)];
  const categories = [...new Set(questions.map((q) => q.category))].sort();
  const difficulties = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
  res.json({ categories, difficulties });
});

router.get('/:id', requireAdmin, (req, res) => {
  const questions = store.getQuestions();
  const q = questions.find((x) => x.id === req.params.id);
  if (!q) return res.status(404).json({ error: 'Question not found' });
  res.json(q);
});

router.post('/', requireAdmin, (req, res) => {
  const missing = validate(req.body);
  if (missing.length) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
  }
  const questions = store.getQuestions();
  const newQuestion = {
    id: req.body.id || nanoid(8),
    question: req.body.question,
    category: req.body.category,
    difficulty: req.body.difficulty,
    expectedAnswer: req.body.expectedAnswer,
    keyConcepts: req.body.keyConcepts || [],
    followUpQuestions: req.body.followUpQuestions || [],
    commonMistakes: req.body.commonMistakes || [],
  };
  questions.push(newQuestion);
  store.saveQuestions(questions);
  res.status(201).json(newQuestion);
});

router.put('/:id', requireAdmin, (req, res) => {
  const questions = store.getQuestions();
  const idx = questions.findIndex((q) => q.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Question not found' });

  const merged = { ...questions[idx], ...req.body, id: req.params.id };
  const missing = validate(merged);
  if (missing.length) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
  }
  questions[idx] = merged;
  store.saveQuestions(questions);
  res.json(merged);
});

router.delete('/:id', requireAdmin, (req, res) => {
  const questions = store.getQuestions();
  const idx = questions.findIndex((q) => q.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Question not found' });
  const [removed] = questions.splice(idx, 1);
  store.saveQuestions(questions);
  res.json(removed);
});

module.exports = router;
