const fs = require('fs');
const path = require('path');
const config = require('./config');
const app = require('./app');
const aiClient = require('./services/aiClient');

// On a fresh data volume, copy the shared seed content (question bank,
// problem sets, papers) so the app is usable on first boot.
function seedDataDir() {
  if (path.resolve(config.seedDir) === path.resolve(config.dataDir)) return;
  fs.mkdirSync(config.dataDir, { recursive: true });
  for (const f of ['questions', 'codingProblems', 'sqlProblems', 'systemDesignProblems', 'papers']) {
    const dest = path.join(config.dataDir, f + '.json');
    const src = path.join(config.seedDir, f + '.json');
    if (!fs.existsSync(dest) && fs.existsSync(src)) fs.copyFileSync(src, dest);
  }
}
seedDataDir();

const server = app.listen(config.port, () => {
  console.log(`Interview Prep running on port ${config.port}`);
  if (!aiClient.hasApiKey()) {
    console.warn('WARNING: no AI API key is configured for the active provider. Copy .env.example to .env and add one.');
  }
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
