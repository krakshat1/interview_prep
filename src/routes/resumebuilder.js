const express = require('express');
const store = require('../services/store');
const { improveResumeText, reviewResume } = require('../services/aiClient');

const router = express.Router();

const EMPTY_DRAFT = {
  contact: { name: '', email: '', phone: '', location: '', links: [] },
  targetRole: '',
  summary: '',
  experience: [],
  education: [],
  skills: [],
  projects: [],
};

router.get('/draft', (req, res) => {
  res.json(store.getResumeDraft(req.user.id) || EMPTY_DRAFT);
});

router.put('/draft', (req, res) => {
  store.saveResumeDraft(req.user.id, req.body);
  res.json({ ok: true });
});

// POST /api/resumebuilder/improve { text, sectionType, targetRole }
router.post('/improve', async (req, res) => {
  try {
    const text = (req.body.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Nothing to improve yet - write a first draft of this line.' });
    const result = await improveResumeText({ text, sectionType: req.body.sectionType, targetRole: req.body.targetRole });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/resumebuilder/review - holistic review of the saved draft
router.post('/review', async (req, res) => {
  try {
    const draft = store.getResumeDraft(req.user.id);
    if (!draft) return res.status(400).json({ error: 'Save some resume content first.' });
    const review = await reviewResume({ resumeData: draft, targetRole: draft.targetRole });
    res.json(review);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
