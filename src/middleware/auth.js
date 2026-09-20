const store = require('../services/store');

const SESSION_COOKIE = 'session_token';

/** Attaches req.user (without id/passwordHash leakage risk - it's server-side only) if the request carries a valid session cookie. Never blocks the request. */
function attachUser(req, res, next) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) {
    const session = store.getAuthSession(token);
    if (session) {
      const account = store.getAccountById(session.userId);
      if (account) req.user = account;
    }
  }
  next();
}

/** Blocks the request with 401 unless attachUser found a signed-in account. */
function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not signed in.' });
  next();
}

/** Blocks the request with 403 unless the signed-in account is an admin. Assumes requireAuth already ran. */
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only.' });
  next();
}

module.exports = { attachUser, requireAuth, requireAdmin, SESSION_COOKIE };
