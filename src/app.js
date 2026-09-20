const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const config = require('./config');
const routes = require('./routes');
const aiClient = require('./services/aiClient');
const { attachUser, requireAuth } = require('./middleware/auth');

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(attachUser);

app.use('/api/auth', routes.auth);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, hasApiKey: aiClient.hasApiKey() });
});

// Everything else under /api is personal data or shared content that still
// requires being signed in - only /api/auth/* and /api/health are public.
app.use('/api', requireAuth);

app.use('/api/questions', routes.questions);
app.use('/api/interview', routes.interview);
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

app.use(express.static(config.clientDir));

module.exports = app;
