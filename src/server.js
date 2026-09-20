const config = require('./config');
const app = require('./app');
const aiClient = require('./services/aiClient');

app.listen(config.port, () => {
  console.log(`Interview Prep running at http://localhost:${config.port}`);
  if (!aiClient.hasApiKey()) {
    console.warn('WARNING: no AI API key is configured for the active provider. Copy .env.example to .env and add one.');
  }
});
