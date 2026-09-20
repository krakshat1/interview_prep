const express = require('express');
const store = require('../services/store');
const { generateRoadmap } = require('../services/curriculum');
const mastery = require('../services/mastery');

const router = express.Router();

router.get('/', (req, res) => {
  const roadmap = store.getRoadmap(req.user.id);
  if (!roadmap) return res.status(404).json({ error: 'No roadmap yet - complete onboarding first.' });
  res.json(roadmap);
});

// Regenerate from the current profile, optionally pulling in fresh weak
// topics from mastery data (so the plan re-prioritizes what you're actually
// struggling with, not just what you said at onboarding).
router.post('/regenerate', (req, res) => {
  const profile = store.getProfile(req.user.id);
  if (!profile) return res.status(404).json({ error: 'No profile yet - complete onboarding first.' });

  const dueWeak = mastery.getDueForReview(req.user.id).filter((e) => e.status === 'weak').map((e) => e.category);
  const mergedProfile = {
    ...profile,
    weaknesses: [...new Set([...(profile.weaknesses || []), ...dueWeak])],
  };

  const roadmap = generateRoadmap(mergedProfile);
  store.saveRoadmap(req.user.id, roadmap);
  res.json(roadmap);
});

// Toggle a day's completion status.
router.post('/day/:date/complete', (req, res) => {
  const roadmap = store.getRoadmap(req.user.id);
  if (!roadmap) return res.status(404).json({ error: 'No roadmap yet.' });

  const completed = req.body.completed !== false;
  let found = false;
  for (const week of roadmap.weeks) {
    const day = week.days.find((d) => d.date === req.params.date);
    if (day) {
      day.completed = completed;
      found = true;
      break;
    }
  }
  if (!found) return res.status(404).json({ error: 'No day with that date in the current roadmap.' });

  store.saveRoadmap(req.user.id, roadmap);
  res.json({ ok: true });
});

// A trimmed view: today + the current week, for a "what should I do today" widget.
router.get('/today', (req, res) => {
  const roadmap = store.getRoadmap(req.user.id);
  if (!roadmap) return res.status(404).json({ error: 'No roadmap yet.' });

  const todayStr = new Date().toISOString().slice(0, 10);
  for (const week of roadmap.weeks) {
    const day = week.days.find((d) => d.date === todayStr);
    if (day) return res.json({ week: { weekNumber: week.weekNumber, theme: week.theme }, day });
  }
  // No exact match (plan finished or hasn't started yet) - return nearest day.
  const allDays = roadmap.weeks.flatMap((w) => w.days.map((d) => ({ ...d, weekNumber: w.weekNumber, theme: w.theme })));
  const upcoming = allDays.find((d) => d.date >= todayStr);
  res.json({ day: upcoming || null, note: upcoming ? 'Plan has not started yet' : 'Plan has finished' });
});

module.exports = router;
