const express = require('express');
const { nanoid } = require('nanoid');
const store = require('../services/store');
const { runPythonTests } = require('../services/codeSandbox');
const { runQuery } = require('../services/sqlSandbox');
const { evaluateCode, evaluateSql } = require('../services/aiClient');
const mastery = require('../services/mastery');

const router = express.Router();

function stripHiddenFields(problem, hidden) {
  const copy = { ...problem };
  for (const f of hidden) delete copy[f];
  return copy;
}

// ---- Coding (DSA) practice ----

router.get('/coding', (req, res) => {
  const problems = store.getCodingProblems();
  const { topic, difficulty } = req.query;
  let filtered = problems;
  if (topic) filtered = filtered.filter((p) => p.topic === topic);
  if (difficulty) filtered = filtered.filter((p) => p.difficulty === difficulty);
  res.json(filtered.map((p) => stripHiddenFields(p, ['solutionNote'])));
});

router.get('/coding/:id', (req, res) => {
  const problem = store.getCodingProblems().find((p) => p.id === req.params.id);
  if (!problem) return res.status(404).json({ error: 'Problem not found' });
  res.json(stripHiddenFields(problem, ['solutionNote']));
});

router.post('/coding/:id/submit', async (req, res) => {
  try {
    const problem = store.getCodingProblems().find((p) => p.id === req.params.id);
    if (!problem) return res.status(404).json({ error: 'Problem not found' });

    const code = req.body.code || '';
    const { error, results } = await runPythonTests({
      code,
      functionName: problem.functionName,
      testCases: problem.testCases,
    });

    if (error) {
      // Harness/syntax/runtime error before any test could run.
      return res.json({
        runError: error,
        testResults: [],
        passed: 0,
        total: problem.testCases.length,
        correctness: 'incorrect',
        solutionNote: problem.solutionNote,
      });
    }

    const passed = results.filter((r) => r.passed).length;
    const total = results.length;
    const correctness = passed === total ? 'correct' : passed > 0 ? 'partially_correct' : 'incorrect';
    const score = Math.round((passed / total) * 10);

    let review = null;
    try {
      review = await evaluateCode({ problem, code, testResults: results });
    } catch (e) {
      review = null; // don't fail the whole submission if the qualitative review call fails
    }

    mastery.recordAttempt(req.user.id, 'Coding & DSA', { technicalScore: score, correctness });

    const submission = {
      id: nanoid(10),
      type: 'coding',
      problemId: problem.id,
      code,
      testResults: results,
      passed,
      total,
      correctness,
      review,
      submittedAt: new Date().toISOString(),
    };
    store.savePracticeSubmission(req.user.id, submission);

    res.json({
      testResults: results,
      passed,
      total,
      correctness,
      score,
      review,
      solutionNote: problem.solutionNote,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- SQL practice ----

router.get('/sql', (req, res) => {
  const problems = store.getSqlProblems();
  const { topic, difficulty } = req.query;
  let filtered = problems;
  if (topic) filtered = filtered.filter((p) => p.topic === topic);
  if (difficulty) filtered = filtered.filter((p) => p.difficulty === difficulty);
  res.json(filtered.map((p) => stripHiddenFields(p, ['expectedQuery'])));
});

router.get('/sql/:id', (req, res) => {
  const problem = store.getSqlProblems().find((p) => p.id === req.params.id);
  if (!problem) return res.status(404).json({ error: 'Problem not found' });
  res.json(stripHiddenFields(problem, ['expectedQuery']));
});

router.post('/sql/:id/submit', async (req, res) => {
  try {
    const problem = store.getSqlProblems().find((p) => p.id === req.params.id);
    if (!problem) return res.status(404).json({ error: 'Problem not found' });

    const query = req.body.query || '';
    const { matched, error, actualRows, expectedRows } = await runQuery({
      query,
      expectedQuery: problem.expectedQuery,
    });

    const correctness = matched ? 'correct' : 'incorrect';
    const score = matched ? 10 : 0;

    let review = null;
    try {
      review = await evaluateSql({
        problem,
        query,
        resultMatched: matched,
        expectedRows,
        actualRows,
        errorMessage: error,
      });
    } catch (e) {
      review = null;
    }

    mastery.recordAttempt(req.user.id, 'SQL', { technicalScore: score, correctness });

    const submission = {
      id: nanoid(10),
      type: 'sql',
      problemId: problem.id,
      query,
      matched,
      error,
      actualRows,
      expectedRows,
      review,
      submittedAt: new Date().toISOString(),
    };
    store.savePracticeSubmission(req.user.id, submission);

    res.json({ matched, error, actualRows, expectedRows, correctness, score, review });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
