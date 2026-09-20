// Usage: node scripts/reset-password.js <email> <new-password>
// Overwrites the stored bcrypt hash for an existing local account.
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const store = require('../src/services/store');

const [emailArg, password] = process.argv.slice(2);
const email = (emailArg || '').trim().toLowerCase();

if (!email || !password || password.length < 8) {
  console.error('Usage: node scripts/reset-password.js <email> <new-password (min 8 chars)>');
  process.exit(1);
}

const accounts = store.getAccounts();
const account = accounts.find((a) => a.email === email);
if (!account) {
  console.error('No account found for ' + email);
  process.exit(1);
}

account.passwordHash = bcrypt.hashSync(password, 10);
fs.writeFileSync(path.join(require('../src/config').dataDir, 'accounts.json'), JSON.stringify(accounts, null, 2));
console.log('Password updated for ' + email + '. Existing login sessions are unchanged.');
