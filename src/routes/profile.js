const express = require('express');
const store = require('../services/store');
const { TRACKS, generateRoadmap } = require('../services/curriculum');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(store.getProfile(req.user.id));
});

router.get('/tracks', (req, res) => {
  res.json({ tracks: TRACKS });
});

// POST /api/profile - onboarding submit (or full re-onboarding). Always
// (re)generates the roadmap from scratch, since a new profile invalidates
// the old plan.
router.post('/', (req, res) => {
  const {
    track,
    planLength,
    startDate,
    hoursPerDay,
    currentLevel,
    weaknesses,
    targetCompanies,
    resumeText,
  } = req.body;

  if (!TRACKS.includes(track)) {
    return res.status(400).json({ error: `track must be one of: ${TRACKS.join(', ')}` });
  }
  if (!['3-month', '6-month'].includes(planLength)) {
    return res.status(400).json({ error: "planLength must be '3-month' or '6-month'" });
  }

  const profile = {
    track,
    planLength,
    startDate: startDate || new Date().toISOString().slice(0, 10),
    hoursPerDay: Number(hoursPerDay) || 2,
    currentLevel: currentLevel || 'Beginner',
    weaknesses: Array.isArray(weaknesses) ? weaknesses : (weaknesses || '').split(',').map((s) => s.trim()).filter(Boolean),
    targetCompanies: Array.isArray(targetCompanies) ? targetCompanies : (targetCompanies || '').split(',').map((s) => s.trim()).filter(Boolean),
    resumeText: resumeText || '',
    createdAt: store.getProfile(req.user.id)?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  store.saveProfile(req.user.id, profile);

  const roadmap = generateRoadmap(profile);
  store.saveRoadmap(req.user.id, roadmap);

  res.status(201).json({ profile, roadmap });
});

module.exports = router;
