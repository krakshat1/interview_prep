// Research papers reading list - a curated set of foundational AI papers,
// each with a plain-language explanation for readers who don't want to read
// the original paper, alongside the technical concepts for those who do.
// Read access is open to any signed-in user; editing is admin-only, same
// pattern as the question bank.
const express = require('express');
const { nanoid } = require('nanoid');
const store = require('../services/store');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const REQUIRED_FIELDS = ['title', 'authors', 'year', 'group', 'simpleExplanation'];

function validate(body) {
  const missing = REQUIRED_FIELDS.filter((f) => !body[f] || !String(body[f]).trim());
  return missing;
}

// GET /api/papers?group= - the full reading list, optionally filtered to one
// category (e.g. "Generative AI"). Sorted by the curated reading order.
router.get('/', (req, res) => {
  const { group } = req.query;
  let papers = store.getPapers();
  if (group) papers = papers.filter((p) => p.group === group);
  papers = [...papers].sort((a, b) => (a.order || 0) - (b.order || 0));
  res.json(papers);
});

// GET /api/papers/meta - distinct groups, for building the page's section
// filter/nav without hard-coding the category list on the client.
router.get('/meta', (req, res) => {
  const papers = store.getPapers();
  const groups = [...new Set(papers.map((p) => p.group))];
  res.json({ groups });
});

router.get('/:id', (req, res) => {
  const paper = store.getPapers().find((p) => p.id === req.params.id);
  if (!paper) return res.status(404).json({ error: 'Paper not found' });
  res.json(paper);
});

router.post('/', requireAdmin, (req, res) => {
  const missing = validate(req.body);
  if (missing.length) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
  }
  const papers = store.getPapers();
  const newPaper = {
    id: req.body.id || nanoid(8),
    order: req.body.order ?? papers.length + 1,
    title: req.body.title,
    authors: req.body.authors,
    year: req.body.year,
    arxivUrl: req.body.arxivUrl || '',
    group: req.body.group,
    oneLiner: req.body.oneLiner || '',
    simpleExplanation: req.body.simpleExplanation,
    whyItMatters: req.body.whyItMatters || [],
    keyConcepts: req.body.keyConcepts || [],
  };
  papers.push(newPaper);
  store.savePapers(papers);
  res.status(201).json(newPaper);
});

router.put('/:id', requireAdmin, (req, res) => {
  const papers = store.getPapers();
  const idx = papers.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Paper not found' });

  const merged = { ...papers[idx], ...req.body, id: req.params.id };
  const missing = validate(merged);
  if (missing.length) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
  }
  papers[idx] = merged;
  store.savePapers(papers);
  res.json(merged);
});

router.delete('/:id', requireAdmin, (req, res) => {
  const papers = store.getPapers();
  const idx = papers.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Paper not found' });
  const [removed] = papers.splice(idx, 1);
  store.savePapers(papers);
  res.json(removed);
});

module.exports = router;
