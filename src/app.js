const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');

const config = require('./config');
const routes = require('./routes');
const aiClient = require('./services/aiClient');
const { attachUser, requireAuth } = require('./middleware/auth');
const { securityHeaders, rateLimit } = require('./middleware/security');

const app = express();

// Behind a platform proxy (Render, Railway, Fly...) so req.ip and secure
// cookies reflect the real client connection.
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(securityHeaders);
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(attachUser);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, hasApiKey: aiClient.hasApiKey() });
});

// Brute-force protection on the public auth endpoints.
app.use(
  '/api/auth/login',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: 'Too many login attempts. Try again in a few minutes.' })
);
app.use(
  '/api/auth/signup',
  rateLimit({ windowMs: 60 * 60 * 1000, max: 15, message: 'Too many sign-ups from this network. Try again later.' })
);
app.use('/api/auth', routes.auth);

// Everything else under /api is personal data or shared content that still
// requires being signed in - only /api/auth/* and /api/health are public.
app.use('/api', requireAuth);

// Per-user cap so one account can't run up the AI bill: every POST is
// potentially an LLM call.
const perUser = (req) => req.user.id;
app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 240, key: perUser }));
const postLimiter = rateLimit({ windowMs: 60 * 1000, max: 40, key: perUser, message: 'You are going a bit fast - wait a moment and try again.' });
app.use('/api', (req, res, next) => (req.method === 'POST' ? postLimiter(req, res, next) : next()));

app.use('/api/questions', routes.questions);
app.use('/api/papers', routes.papers);
app.use('/api/interview', routes.interview);
app.use('/api/study', routes.study);
app.use('/api/reports', routes.reports);
app.use('/api/profile', routes.profile);
app.use('/api/roadmap', routes.roadmap);
app.use('/api/dashboard', routes.dashboard);
app.use('/api/practice', routes.practice);
app.use('/api/resume', routes.resume);
app.use('/api/jobmatch', routes.jobmatch);
app.use('/api/applications', routes.applications);
app.use('/api/systemdesign', routes.systemdesign);
app.use('/api/resumebuilder', routes.resumebuilder);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// Public marketing page at "/"; signed-in visitors go straight to the app.
app.get('/', (req, res) => {
  if (req.user) return res.redirect('/start.html');
  res.sendFile(path.join(config.clientDir, 'landing.html'));
});

app.use(express.static(config.clientDir, { index: false, maxAge: config.isProd ? '1h' : 0 }));

module.exports = app;
