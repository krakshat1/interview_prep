const express = require('express');
const { nanoid } = require('nanoid');
const store = require('../services/store');

const router = express.Router();

// Lightweight job-application tracker (section 28). Deliberately simple -
// local CRUD only, no calendar/email integration.

router.get('/', (req, res) => {
  const apps = store.getApplications(req.user.id).sort((a, b) => new Date(b.appliedDate || b.createdAt) - new Date(a.appliedDate || a.createdAt));
  res.json(apps);
});

router.post('/', (req, res) => {
  const { company, role, jobDescription, status, appliedDate, notes } = req.body;
  if (!company || !role) return res.status(400).json({ error: 'company and role are required' });

  const apps = store.getApplications(req.user.id);
  const application = {
    id: nanoid(8),
    company,
    role,
    jobDescription: jobDescription || '',
    status: status || 'Applied', // Applied | Phone Screen | Technical | Onsite | Offer | Rejected
    appliedDate: appliedDate || new Date().toISOString().slice(0, 10),
    interviewStages: [],
    notes: notes || '',
    createdAt: new Date().toISOString(),
  };
  apps.push(application);
  store.saveApplications(req.user.id, apps);
  res.status(201).json(application);
});

router.put('/:id', (req, res) => {
  const apps = store.getApplications(req.user.id);
  const idx = apps.findIndex((a) => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Application not found' });
  apps[idx] = { ...apps[idx], ...req.body, id: req.params.id };
  store.saveApplications(req.user.id, apps);
  res.json(apps[idx]);
});

// Append an interview-stage record (stage name, date, feedback, outcome) -
// this is how "interview feedback / rejection reasons" (section 28) get tracked.
router.post('/:id/stage', (req, res) => {
  const apps = store.getApplications(req.user.id);
  const idx = apps.findIndex((a) => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Application not found' });

  const stage = {
    id: nanoid(6),
    stage: req.body.stage || 'Interview',
    date: req.body.date || new Date().toISOString().slice(0, 10),
    feedback: req.body.feedback || '',
    outcome: req.body.outcome || 'Pending', // Pending | Passed | Failed
  };
  apps[idx].interviewStages.push(stage);
  store.saveApplications(req.user.id, apps);
  res.json(apps[idx]);
});

router.delete('/:id', (req, res) => {
  const apps = store.getApplications(req.user.id);
  const idx = apps.findIndex((a) => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Application not found' });
  const [removed] = apps.splice(idx, 1);
  store.saveApplications(req.user.id, apps);
  res.json(removed);
});

module.exports = router;
