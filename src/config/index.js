// Central place for environment loading and filesystem locations, so nothing
// else in the app needs to know where the project root or data folder lives.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const rootDir = path.join(__dirname, '..', '..');

module.exports = {
  port: process.env.PORT || 3000,
  rootDir,
  dataDir: process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(rootDir, 'data'),
  clientDir: path.join(rootDir, 'client'),
};
