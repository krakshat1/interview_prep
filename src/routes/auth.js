const express = require('express');
const bcrypt = require('bcryptjs');
const store = require('../services/store');
const { SESSION_COOKIE } = require('../middleware/auth');

const router = express.Router();
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, matches store.js

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: SESSION_TTL_MS,
  });
}

router.post('/signup', (req, res) => {
  const { email, password } = req.body || {};
  const normalizedEmail = (email || '').trim().toLowerCase();

  if (!EMAIL_RE.test(normalizedEmail)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  if (store.getAccountByEmail(normalizedEmail)) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }

  const isFirstAccount = store.getAccounts().length === 0;
  const passwordHash = bcrypt.hashSync(password, 10);
  // The first account on an install owns the pre-existing data and is the
  // admin who curates the shared question bank; everyone after that is a
  // regular user.
  const account = store.createAccount({ email: normalizedEmail, passwordHash, role: isFirstAccount ? 'admin' : 'user' });

  if (isFirstAccount) {
    store.migrateLegacyDataToFirstAccount(account.id);
  }

  const token = store.createAuthSession(account.id);
  setSessionCookie(res, token);
  res.json({ id: account.id, email: account.email, role: account.role });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const normalizedEmail = (email || '').trim().toLowerCase();
  const account = store.getAccountByEmail(normalizedEmail);

  if (!account || !bcrypt.compareSync(password || '', account.passwordHash)) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }

  const token = store.createAuthSession(account.id);
  setSessionCookie(res, token);
  res.json({ id: account.id, email: account.email, role: account.role });
});

router.post('/logout', (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) store.deleteAuthSession(token);
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not signed in.' });
  res.json({ id: req.user.id, email: req.user.email, role: req.user.role });
});

module.exports = router;
