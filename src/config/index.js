// Central place for environment loading and filesystem locations, so nothing
// else in the app needs to know where the project root or data folder lives.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const rootDir = path.join(__dirname, '..', '..');

module.exports = {
  port: process.env.PORT || 3000,
  isProd: process.env.NODE_ENV === 'production',
  rootDir,
  // Seed content shipped in the repo; copied into dataDir on first boot so a
  // fresh persistent volume (cloud deploys) starts with the question bank.
  seedDir: path.join(rootDir, 'data'),
  dataDir: process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(rootDir, 'data'),
  clientDir: path.join(rootDir, 'client'),
};
