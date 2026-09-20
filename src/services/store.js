// Simple JSON-file persistence. This is a personal, local, now-multi-user
// app, so there is no real concurrency to worry about - a plain read/write
// is fine. Two kinds of data live here:
//  - Shared content (question bank, coding/SQL problem sets): one file for
//    everyone, same as before.
//  - Per-user data (profile, roadmap, mastery, sessions, applications,
//    practice submissions): scoped under data/users/<userId>/, keyed by the
//    userId every one of these functions now takes as its first argument.
const fs = require('fs');
const path = require('path');
const { nanoid } = require('nanoid');
const config = require('../config');

const DATA_DIR = config.dataDir;
const QUESTIONS_FILE = path.join(DATA_DIR, 'questions.json');
const CODING_PROBLEMS_FILE = path.join(DATA_DIR, 'codingProblems.json');
const SQL_PROBLEMS_FILE = path.join(DATA_DIR, 'sqlProblems.json');
const SYSTEM_DESIGN_PROBLEMS_FILE = path.join(DATA_DIR, 'systemDesignProblems.json');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');
const AUTH_SESSIONS_FILE = path.join(DATA_DIR, 'authSessions.json');
const USERS_DIR = path.join(DATA_DIR, 'users');

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function readJson(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function userDir(userId) {
  return path.join(USERS_DIR, userId);
}

function userFile(userId, name) {
  return path.join(userDir(userId), name);
}

// ---- Question bank (shared across every account, admin-managed) ----
function getQuestions() {
  return readJson(QUESTIONS_FILE, []);
}

function saveQuestions(questions) {
  writeJson(QUESTIONS_FILE, questions);
}

// ---- Personal questions (e.g. resume-defense questions generated from a
// user's own resume) - these aren't shared, since one person's resume claims
// aren't relevant to anyone else's interview practice. Mock interviews pull
// from getQuestions() + getUserQuestions(userId) combined.
function getUserQuestions(userId) {
  return readJson(userFile(userId, 'personalQuestions.json'), []);
}

function saveUserQuestions(userId, questions) {
  writeJson(userFile(userId, 'personalQuestions.json'), questions);
}

// ---- Session index (lightweight summary list, for the reports/history page) ----
function getSessionIndex(userId) {
  return readJson(userFile(userId, 'sessions.json'), []);
}

function saveSessionIndex(userId, index) {
  writeJson(userFile(userId, 'sessions.json'), index);
}

function addOrUpdateSessionSummary(userId, summary) {
  const index = getSessionIndex(userId);
  const i = index.findIndex((s) => s.id === summary.id);
  if (i >= 0) index[i] = summary;
  else index.push(summary);
  saveSessionIndex(userId, index);
}

// ---- Full session transcripts (one file per session) ----
function getSessionFilePath(userId, sessionId) {
  return path.join(userDir(userId), 'sessions', `${sessionId}.json`);
}

function getSession(userId, sessionId) {
  return readJson(getSessionFilePath(userId, sessionId), null);
}

function saveSession(userId, session) {
  writeJson(getSessionFilePath(userId, session.id), session);
}

// ---- Profile / onboarding ----
function getProfile(userId) {
  return readJson(userFile(userId, 'profile.json'), null);
}

function saveProfile(userId, profile) {
  writeJson(userFile(userId, 'profile.json'), profile);
}

// ---- Roadmap ----
function getRoadmap(userId) {
  return readJson(userFile(userId, 'roadmap.json'), null);
}

function saveRoadmap(userId, roadmap) {
  writeJson(userFile(userId, 'roadmap.json'), roadmap);
}

// ---- Mastery / spaced repetition ----
function getMastery(userId) {
  return readJson(userFile(userId, 'mastery.json'), {});
}

function saveMastery(userId, mastery) {
  writeJson(userFile(userId, 'mastery.json'), mastery);
}

// ---- Coding & SQL practice problem banks (shared across every account) ----
function getCodingProblems() {
  return readJson(CODING_PROBLEMS_FILE, []);
}

function getSqlProblems() {
  return readJson(SQL_PROBLEMS_FILE, []);
}

function getSystemDesignProblems() {
  return readJson(SYSTEM_DESIGN_PROBLEMS_FILE, []);
}

function getPracticeSubmissionFilePath(userId, id) {
  return path.join(userDir(userId), 'practiceSubmissions', `${id}.json`);
}

function savePracticeSubmission(userId, submission) {
  writeJson(getPracticeSubmissionFilePath(userId, submission.id), submission);
}

function getPracticeSubmission(userId, id) {
  return readJson(getPracticeSubmissionFilePath(userId, id), null);
}

// ---- Resume builder draft ----
function getResumeDraft(userId) {
  return readJson(userFile(userId, 'resumeDraft.json'), null);
}

function saveResumeDraft(userId, draft) {
  writeJson(userFile(userId, 'resumeDraft.json'), draft);
}

// ---- Job application tracker ----
function getApplications(userId) {
  return readJson(userFile(userId, 'applications.json'), []);
}

function saveApplications(userId, applications) {
  writeJson(userFile(userId, 'applications.json'), applications);
}

// ---- Accounts (email/password signup) ----
function getAccounts() {
  return readJson(ACCOUNTS_FILE, []);
}

function saveAccounts(accounts) {
  writeJson(ACCOUNTS_FILE, accounts);
}

function getAccountByEmail(email) {
  return getAccounts().find((u) => u.email === email) || null;
}

function getAccountById(id) {
  return getAccounts().find((u) => u.id === id) || null;
}

function createAccount({ email, passwordHash, role }) {
  const accounts = getAccounts();
  const account = { id: nanoid(12), email, passwordHash, role: role || 'user', createdAt: new Date().toISOString() };
  accounts.push(account);
  saveAccounts(accounts);
  return account;
}

// ---- Login sessions (separate from mock-interview "sessions" above) ----
function getAuthSessions() {
  return readJson(AUTH_SESSIONS_FILE, []);
}

function saveAuthSessions(sessions) {
  writeJson(AUTH_SESSIONS_FILE, sessions);
}

function createAuthSession(userId) {
  const sessions = getAuthSessions().filter((s) => s.expiresAt > Date.now()); // sweep expired
  const token = nanoid(32);
  sessions.push({ token, userId, expiresAt: Date.now() + SESSION_TTL_MS });
  saveAuthSessions(sessions);
  return token;
}

function getAuthSession(token) {
  const session = getAuthSessions().find((s) => s.token === token);
  if (!session || session.expiresAt <= Date.now()) return null;
  return session;
}

function deleteAuthSession(token) {
  saveAuthSessions(getAuthSessions().filter((s) => s.token !== token));
}

/**
 * One-time migration for the very first account created on a given
 * install: this app started single-user, storing personal data directly
 * under data/ (data/profile.json, data/roadmap.json, etc). The first person
 * to sign up inherits that pre-existing data as their own account instead
 * of starting empty. Every account after the first just starts fresh.
 */
function migrateLegacyDataToFirstAccount(userId) {
  const legacyFiles = ['profile.json', 'roadmap.json', 'mastery.json', 'sessions.json', 'applications.json'];
  for (const name of legacyFiles) {
    const legacyPath = path.join(DATA_DIR, name);
    if (fs.existsSync(legacyPath)) {
      fs.mkdirSync(userDir(userId), { recursive: true });
      fs.copyFileSync(legacyPath, userFile(userId, name));
    }
  }
  const legacyDirs = [
    { name: 'sessions', from: path.join(DATA_DIR, 'sessions') },
    { name: 'practiceSubmissions', from: path.join(DATA_DIR, 'practiceSubmissions') },
  ];
  for (const { name, from } of legacyDirs) {
    if (fs.existsSync(from)) {
      const to = path.join(userDir(userId), name);
      fs.mkdirSync(to, { recursive: true });
      for (const file of fs.readdirSync(from)) {
        fs.copyFileSync(path.join(from, file), path.join(to, file));
      }
    }
  }
}

module.exports = {
  getQuestions,
  saveQuestions,
  getUserQuestions,
  saveUserQuestions,
  getSessionIndex,
  saveSessionIndex,
  addOrUpdateSessionSummary,
  getSession,
  saveSession,
  getProfile,
  saveProfile,
  getRoadmap,
  saveRoadmap,
  getMastery,
  saveMastery,
  getCodingProblems,
  getSqlProblems,
  getSystemDesignProblems,
  savePracticeSubmission,
  getPracticeSubmission,
  getResumeDraft,
  saveResumeDraft,
  getApplications,
  saveApplications,
  getAccounts,
  getAccountByEmail,
  getAccountById,
  createAccount,
  createAuthSession,
  getAuthSession,
  deleteAuthSession,
  migrateLegacyDataToFirstAccount,
};
