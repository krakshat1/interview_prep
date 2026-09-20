// Runs a candidate's submitted Python function against test cases using a
// real local Python interpreter (child process, not a network sandbox -
// this is a personal single-user app running on your own machine, so
// executing your own submitted code locally carries no more risk than
// running any other script you write). A timeout guards against infinite
// loops hanging the server.
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PYTHON_BIN = process.env.PYTHON_BIN || 'python';
const TIMEOUT_MS = 8000;

function buildHarness(userCode, functionName, testCases) {
  return `
import json, sys

${userCode}

test_cases = json.loads(${JSON.stringify(JSON.stringify(testCases))})
function_name = ${JSON.stringify(functionName)}

func = globals().get(function_name)
if func is None:
    print(json.dumps({"harnessError": f"Function '{function_name}' was not found. Define it with exactly that name."}))
    sys.exit(0)

results = []
for tc in test_cases:
    try:
        args = tc["input"]
        actual = func(*args) if isinstance(args, list) else func(args)
        results.append({"passed": actual == tc["expected"], "actual": actual, "expected": tc["expected"], "input": tc["input"]})
    except Exception as e:
        results.append({"passed": False, "actual": None, "expected": tc["expected"], "input": tc["input"], "error": str(e)})

print(json.dumps({"results": results}))
`;
}

function runPythonTests({ code, functionName, testCases }) {
  const tmpFile = path.join(os.tmpdir(), `interview-prep-code-${Date.now()}-${Math.random().toString(36).slice(2)}.py`);
  const harness = buildHarness(code, functionName, testCases);
  fs.writeFileSync(tmpFile, harness, 'utf-8');

  return new Promise((resolve) => {
    execFile(PYTHON_BIN, [tmpFile], { timeout: TIMEOUT_MS, maxBuffer: 2 * 1024 * 1024 }, (error, stdout, stderr) => {
      fs.unlink(tmpFile, () => {});
      if (error) {
        if (error.killed) return resolve({ error: 'Execution timed out (possible infinite loop).', results: [] });
        return resolve({ error: (stderr || '').trim() || error.message, results: [] });
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        if (parsed.harnessError) return resolve({ error: parsed.harnessError, results: [] });
        resolve({ error: null, results: parsed.results });
      } catch (e) {
        resolve({ error: 'Could not parse test runner output: ' + stdout.slice(0, 500), results: [] });
      }
    });
  });
}

module.exports = { runPythonTests };
