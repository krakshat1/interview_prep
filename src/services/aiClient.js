// All AI calls for the app (interview evaluation, coach summary, code review,
// SQL review, resume questions, JD gap analysis) go through callAI() below,
// which dispatches to whichever provider AI_PROVIDER selects. Switching
// providers is a one-line env change - no code changes needed - since every
// call site here always supplies both a Zod `schema` (for validating/typing
// the parsed result, used by every provider) and a plain-JSON-schema
// `jsonSchema` (used only by providers that want it, like the "gemini" one).
const { z } = require('zod/v4');
const AnthropicSDK = require('@anthropic-ai/sdk');
const { zodOutputFormat } = require('@anthropic-ai/sdk/helpers/zod');

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

function getProvider() {
  return (process.env.AI_PROVIDER || 'anthropic').toLowerCase();
}

function hasApiKey() {
  const provider = getProvider();
  if (provider === 'gemini') return !!(process.env.AI_API_KEY_GEMINI || process.env.AI_API_KEY);
  if (provider === 'groq') return !!(process.env.AI_API_KEY_GROQ || process.env.AI_API_KEY);
  if (provider === 'openrouter') return !!(process.env.AI_API_KEY_OPENROUTER || process.env.AI_API_KEY);
  return !!(process.env.AI_API_KEY_ANTHROPIC || process.env.AI_API_KEY);
}

let anthropicClient = null;
function getAnthropicClient() {
  const key = process.env.AI_API_KEY_ANTHROPIC || process.env.AI_API_KEY;
  if (!key) {
    throw new Error('No API key configured for the "anthropic" provider. Set AI_API_KEY_ANTHROPIC in .env.');
  }
  if (!anthropicClient) anthropicClient = new AnthropicSDK({ apiKey: key });
  return anthropicClient;
}

async function callAnthropic({ system, prompt, schema }) {
  const client = getAnthropicClient();
  const model = process.env.AI_MODEL_ANTHROPIC || process.env.AI_MODEL || 'claude-opus-5';
  if (schema) {
    const response = await client.messages.parse({
      model,
      max_tokens: 16000,
      system,
      messages: [{ role: 'user', content: prompt }],
      output_config: { format: zodOutputFormat(schema) },
    });
    if (!response.parsed_output) throw new Error('The AI did not return a parseable response.');
    return response.parsed_output;
  }
  const response = await client.messages.create({
    model,
    max_tokens: 16000,
    system,
    messages: [{ role: 'user', content: prompt }],
  });
  const textBlock = response.content.find((b) => b.type === 'text');
  return (textBlock?.text || '').trim();
}

async function callGemini({ system, prompt, schema, jsonSchema }) {
  const apiKey = process.env.AI_API_KEY_GEMINI || process.env.AI_API_KEY;
  if (!apiKey) {
    throw new Error('No API key configured for the "gemini" provider. Set AI_API_KEY_GEMINI in .env.');
  }
  const model = process.env.AI_MODEL_GEMINI || process.env.AI_MODEL || 'gemini-3.6-flash';
  const generationConfig = { maxOutputTokens: 8000 };
  if (jsonSchema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = jsonSchema;
  }

  const res = await fetch(`${GEMINI_API_BASE}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig,
    }),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error?.message || `AI request failed with status ${res.status}`);
  }

  const part = (body?.candidates?.[0]?.content?.parts || []).find((p) => typeof p.text === 'string');
  const text = part?.text;
  if (!text) throw new Error('The AI did not return a text response.');
  if (!schema) return text.trim();

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error('The AI did not return valid JSON: ' + text.slice(0, 500));
  }
  return schema.parse(parsed);
}

const OPENAI_COMPAT = {
  groq: { url: GROQ_API_URL, keyEnv: 'AI_API_KEY_GROQ', modelEnv: 'AI_MODEL_GROQ', defaultModel: 'openai/gpt-oss-120b' },
  openrouter: { url: 'https://openrouter.ai/api/v1/chat/completions', keyEnv: 'AI_API_KEY_OPENROUTER', modelEnv: 'AI_MODEL_OPENROUTER', defaultModel: 'meta-llama/llama-3.3-70b-instruct:free' },
};

async function callOpenAICompat(provider, { system, prompt, schema, jsonSchema }) {
  const cfg = OPENAI_COMPAT[provider];
  const apiKey = process.env[cfg.keyEnv] || process.env.AI_API_KEY;
  if (!apiKey) {
    throw new Error(`No API key configured for the "${provider}" provider. Set ${cfg.keyEnv} in .env.`);
  }
  const model = process.env[cfg.modelEnv] || process.env.AI_MODEL || cfg.defaultModel;
  const body = { model, max_tokens: 8000, messages: [] };
  let sys = system;
  if (jsonSchema) {
    body.response_format = { type: 'json_object' };
    sys += '\n\nRespond with a single JSON object that matches this JSON schema exactly:\n' + JSON.stringify(jsonSchema);
  }
  body.messages.push({ role: 'system', content: sys }, { role: 'user', content: prompt });

  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `AI request failed with status ${res.status}`);
  }
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('The AI did not return a text response.');
  if (!schema) return text.trim();

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error('The AI did not return valid JSON: ' + text.slice(0, 500));
  }
  return schema.parse(parsed);
}

/**
 * Calls the configured model. Pass `jsonSchema` (plain JSON-schema-shaped
 * object) + `schema` (the matching Zod schema, for validating/typing the
 * parsed result) for structured output, or omit both for a plain-text reply.
 */
async function callAI({ system, prompt, schema, jsonSchema }) {
  const provider = getProvider();
  if (provider === 'gemini') return callGemini({ system, prompt, schema, jsonSchema });
  if (OPENAI_COMPAT[provider]) return callOpenAICompat(provider, { system, prompt, schema, jsonSchema });
  return callAnthropic({ system, prompt, schema });
}

const EvaluationSchema = z.object({
  technicalScore: z.number().int().min(0).max(10),
  communicationScore: z.number().int().min(0).max(10),
  confidenceScore: z.number().int().min(0).max(10),
  correctness: z.enum(['correct', 'partially_correct', 'incorrect']),
  strengths: z.array(z.string()),
  missingConcepts: z.array(z.string()),
  communicationIssues: z.array(z.string()),
  interviewerRemark: z.string(),
  recommendedAnswer: z.string(),
  followUp: z.object({
    shouldAskFollowUp: z.boolean(),
    question: z.string().nullable(),
    reason: z.string(),
  }),
  difficultyAdjustment: z.enum(['increase', 'decrease', 'same']),
});

const EvaluationJsonSchema = {
  type: 'object',
  properties: {
    technicalScore: { type: 'integer' },
    communicationScore: { type: 'integer' },
    confidenceScore: { type: 'integer' },
    correctness: { type: 'string', enum: ['correct', 'partially_correct', 'incorrect'] },
    strengths: { type: 'array', items: { type: 'string' } },
    missingConcepts: { type: 'array', items: { type: 'string' } },
    communicationIssues: { type: 'array', items: { type: 'string' } },
    interviewerRemark: { type: 'string' },
    recommendedAnswer: { type: 'string' },
    followUp: {
      type: 'object',
      properties: {
        shouldAskFollowUp: { type: 'boolean' },
        question: { type: 'string', nullable: true },
        reason: { type: 'string' },
      },
      required: ['shouldAskFollowUp', 'question', 'reason'],
    },
    difficultyAdjustment: { type: 'string', enum: ['increase', 'decrease', 'same'] },
  },
  required: [
    'technicalScore', 'communicationScore', 'confidenceScore', 'correctness',
    'strengths', 'missingConcepts', 'communicationIssues', 'interviewerRemark',
    'recommendedAnswer', 'followUp', 'difficultyAdjustment',
  ],
};

const EVALUATION_SYSTEM_PROMPT = `You are a senior bar-raiser interviewer at a top-tier tech company (the caliber of interviewer whose sign-off can veto a hire even when everyone else on the loop says yes). You are conducting a live mock interview. Your job is to produce an honest, calibrated signal the candidate can trust - not to make them feel good. A candidate who only ever hears encouraging feedback here will walk into a real interview unprepared and get a rude surprise; that failure mode is worse than a harsh mock score, so default to skepticism, not generosity.

You will be given:
- The question that was asked
- The candidate's expected/model answer, key concepts, and common mistakes (reference material - the candidate does NOT see this)
- The candidate's actual spoken answer (transcribed from voice, so it may contain filler words, informal phrasing, or minor transcription errors - be lenient about transcription artifacts but not about substance)
- Local statistics already computed on the transcript (word count, filler word count/rate)

Evaluate the candidate's answer and produce a structured evaluation.

Calibration (apply this strictly - do not grade on a curve, and do not let fluent delivery substitute for substance):
- technicalScore 9-10: correct, complete, and precise - covers the key concepts with correct terminology and would satisfy a skeptical interviewer with no follow-up needed. Reserve this for genuinely strong answers, not merely "didn't say anything wrong."
- technicalScore 7-8: correct core idea with correct terminology, but missing a secondary concept, an edge case, or is thinner than a strong candidate's answer would be.
- technicalScore 4-6: the right general direction but vague, hand-wavy, missing multiple key concepts, or leans on buzzwords without demonstrating the underlying mechanism. Vague-but-not-wrong is a 5, not a 7 - "sounds plausible" is not the bar.
- technicalScore 1-3: substantively incorrect, or so thin/generic that it wouldn't survive a single follow-up question.
- technicalScore 0: no real attempt, or the answer contradicts the fundamentals of the topic.
- communicationScore reflects structure, clarity, conciseness, professional language, and appropriate use of terminology - independent of whether the technical content was fully correct. Rambling toward a right answer is still a communication weakness; say so.
- confidenceScore reflects how confident and decisive the answer sounded (hedging, filler words, rambling, and the provided filler-word stats should weigh heavily here). A high filler rate should noticeably lower this score, and heavy hedging language ("I think maybe", "I'm not totally sure but") should too, even if the content underneath is correct.
- Be specific and actionable, not generic - quote or reference what the candidate actually said, and name the exact missing concept rather than saying "could be more thorough."
- interviewerRemark: 1-2 sentences, in the voice of the interviewer speaking to the candidate directly, e.g. what you'd actually say out loud before moving on. Do NOT reveal the full correct answer here. Do not soften a weak answer with false praise - if it was weak, the remark should make that unambiguous while staying professional.
- recommendedAnswer: a concise, professional, interview-ready version of the ideal answer, 2-5 sentences, based on the reference material.
- followUp.shouldAskFollowUp: true if a natural follow-up would probe deeper (answer was vague, partially correct, or this is a rich topic). Bias toward true for anything scoring below 7 - a real interviewer would push on a shaky answer rather than move on politely.
- difficultyAdjustment: "increase" only if they handled it comfortably and correctly (technicalScore >= 7); "decrease" if they clearly struggled (technicalScore <= 4); "same" otherwise.
- Never be sycophantic, and never round a mediocre answer up because the candidate sounded confident or used the right jargon. Confident-sounding wrong answers are a common real-interview failure mode and should score on substance alone.`;

async function evaluateAnswer({ question, transcript, fillerStats }) {
  const userPrompt = `QUESTION ASKED:
${question.question}

CATEGORY: ${question.category} | DIFFICULTY: ${question.difficulty}

REFERENCE MATERIAL (not shown to candidate):
Expected answer: ${question.expectedAnswer || '(not curated for this follow-up question - use your own expert knowledge as the reference standard)'}
Key concepts: ${(question.keyConcepts || []).join('; ') || '(use your own expert judgment)'}
Common mistakes to watch for: ${(question.commonMistakes || []).join('; ') || '(none provided)'}
Suggested follow-ups for this question (use as inspiration, not mandatory): ${(question.followUpQuestions || []).join('; ') || '(none provided)'}

CANDIDATE'S TRANSCRIBED SPOKEN ANSWER:
"""
${transcript || '(no answer given / empty transcript)'}
"""

LOCAL TRANSCRIPT STATS:
Word count: ${fillerStats.wordCount}
Filler word count: ${fillerStats.totalFillerWords}
Filler rate: ${(fillerStats.fillerRate * 100).toFixed(1)}%
Filler breakdown: ${JSON.stringify(fillerStats.breakdown)}

Evaluate now.`;

  return callAI({ system: EVALUATION_SYSTEM_PROMPT, prompt: userPrompt, schema: EvaluationSchema, jsonSchema: EvaluationJsonSchema });
}

const REPORT_SYSTEM_PROMPT = `You are a professional interview coach. You will be given a JSON summary of a completed mock interview session (per-question scores, missing concepts, communication issues, filler word stats). Write a short, encouraging-but-honest coaching summary (4-7 sentences) covering: the overall trend, the 1-2 biggest recurring weaknesses to fix next, and one concrete thing to practice before the next session. Return plain text only, no markdown headers.`;

async function generateCoachSummary(sessionSummaryData) {
  return callAI({ system: REPORT_SYSTEM_PROMPT, prompt: JSON.stringify(sessionSummaryData) });
}

// ---------------------------------------------------------------------
// Code practice review (DSA/coding problems). Correctness is determined by
// actually running the code against test cases (see codeSandbox.js) - the
// model is only asked to judge things a test runner can't: code quality,
// efficiency, edge-case coverage, and style.
// ---------------------------------------------------------------------
const CodeReviewSchema = z.object({
  codeQualityScore: z.number().int().min(0).max(10),
  efficiencyScore: z.number().int().min(0).max(10),
  timeComplexity: z.string(),
  spaceComplexity: z.string(),
  strengths: z.array(z.string()),
  edgeCasesMissed: z.array(z.string()),
  suggestions: z.array(z.string()),
  interviewerRemark: z.string(),
});

const CodeReviewJsonSchema = {
  type: 'object',
  properties: {
    codeQualityScore: { type: 'integer' },
    efficiencyScore: { type: 'integer' },
    timeComplexity: { type: 'string' },
    spaceComplexity: { type: 'string' },
    strengths: { type: 'array', items: { type: 'string' } },
    edgeCasesMissed: { type: 'array', items: { type: 'string' } },
    suggestions: { type: 'array', items: { type: 'string' } },
    interviewerRemark: { type: 'string' },
  },
  required: ['codeQualityScore', 'efficiencyScore', 'timeComplexity', 'spaceComplexity', 'strengths', 'edgeCasesMissed', 'suggestions', 'interviewerRemark'],
};

const CODE_REVIEW_SYSTEM_PROMPT = `You are a senior software engineer at a top-tier tech company reviewing a candidate's solution to a coding interview problem, the way a bar-raiser would after watching them code it live. You already know whether their code passed the test cases (given to you) - your job is everything a test runner can't tell you: code quality, time/space complexity, whether they handled edge cases, and how they'd fare explaining trade-offs live. Be specific and reference their actual code, line by line where it matters.

Calibration - grade as if this determines a hire/no-hire signal, not a participation grade:
- efficiencyScore 9-10 only for the asymptotically optimal (or near-optimal) approach for this exact problem. A brute-force solution that passes every test is still a low efficiencyScore (2-4) if a materially better approach exists, even if the candidate never mentioned one - your job is to name it in suggestions, not credit them for correctness alone.
- codeQualityScore should be knocked down for: no handling/mention of the edge cases a real interviewer would probe (empty input, single element, all-duplicates, etc.), unclear naming, no brief comment on non-obvious logic, or code that "works" but wouldn't survive the candidate being asked to extend it live.
- Passing all tests is necessary but not sufficient for a high score on either dimension - a correct-but-naive solution should read as "correct, but here's what's missing," not as a clean pass.
- Don't be sycophantic - if the solution is brute-force when a better approach exists, say so plainly and name the better approach and its complexity, don't just hint at it.`;

async function evaluateCode({ problem, code, testResults }) {
  const passed = testResults.filter((t) => t.passed).length;
  const userPrompt = `PROBLEM: ${problem.title}
DIFFICULTY: ${problem.difficulty} | TOPIC: ${problem.topic}
PROMPT: ${problem.prompt}

CANDIDATE'S CODE:
\`\`\`python
${code}
\`\`\`

TEST RESULTS: ${passed}/${testResults.length} passed
${testResults.map((t, i) => `  Test ${i + 1}: ${t.passed ? 'PASS' : 'FAIL'} - input=${JSON.stringify(t.input)} expected=${JSON.stringify(t.expected)} got=${JSON.stringify(t.actual)}${t.error ? ' error=' + t.error : ''}`).join('\n')}

Review the code now.`;

  return callAI({ system: CODE_REVIEW_SYSTEM_PROMPT, prompt: userPrompt, schema: CodeReviewSchema, jsonSchema: CodeReviewJsonSchema });
}

// ---------------------------------------------------------------------
// SQL practice review. Like code review, correctness (does the result set
// match) is determined by actually running the query (see sqlSandbox.js);
// the model judges style, efficiency, and correctness of approach.
// ---------------------------------------------------------------------
const SqlReviewSchema = z.object({
  styleScore: z.number().int().min(0).max(10),
  efficiencyScore: z.number().int().min(0).max(10),
  strengths: z.array(z.string()),
  issues: z.array(z.string()),
  suggestions: z.array(z.string()),
  interviewerRemark: z.string(),
  recommendedQuery: z.string(),
});

const SqlReviewJsonSchema = {
  type: 'object',
  properties: {
    styleScore: { type: 'integer' },
    efficiencyScore: { type: 'integer' },
    strengths: { type: 'array', items: { type: 'string' } },
    issues: { type: 'array', items: { type: 'string' } },
    suggestions: { type: 'array', items: { type: 'string' } },
    interviewerRemark: { type: 'string' },
    recommendedQuery: { type: 'string' },
  },
  required: ['styleScore', 'efficiencyScore', 'strengths', 'issues', 'suggestions', 'interviewerRemark', 'recommendedQuery'],
};

const SQL_REVIEW_SYSTEM_PROMPT = `You are a senior data engineer at a top-tier tech company reviewing a candidate's SQL solution to an interview problem, the way a bar-raiser would. You already know whether their query's result matched the expected result set (given to you) - focus on what that can't tell you: query style, readability, efficiency (unnecessary subqueries, missing indexes-style thinking, correct JOIN types, correct use of window functions vs GROUP BY, etc.), and whether their approach would hold up on a much larger table. Be specific about their actual query, referencing exact clauses.

Calibration - a matching result set is necessary but not sufficient for a high score:
- efficiencyScore 9-10 only if the query is genuinely how a senior engineer would write it for scale (right join types, no redundant subqueries/self-joins, sargable predicates, correct use of window functions vs. GROUP BY where one is clearly better). A query that "gets the right answer" via a correlated subquery or a non-sargable predicate where a cleaner set-based approach exists should score low-to-mid (3-5) here, not high, even though it passed.
- styleScore should be knocked down for inconsistent casing/formatting, unclear aliases, or a structure that would be hard to extend or debug at 10x the row count.
- Always name the specific idiom or rewrite that would fix an issue - not just "this could be more efficient."
- Don't be sycophantic - a correct-but-unpolished query is a real gap, not a pass.`;

async function evaluateSql({ problem, query, resultMatched, expectedRows, actualRows, errorMessage }) {
  const userPrompt = `PROBLEM: ${problem.title}
DIFFICULTY: ${problem.difficulty} | TOPIC: ${problem.topic}
PROMPT: ${problem.prompt}
SCHEMA: ${problem.schemaDescription}

CANDIDATE'S QUERY:
\`\`\`sql
${query}
\`\`\`

EXECUTION RESULT: ${errorMessage ? `ERROR: ${errorMessage}` : resultMatched ? 'Result set matched expected output' : 'Result set did NOT match expected output'}
${errorMessage ? '' : `Expected rows (sample): ${JSON.stringify((expectedRows || []).slice(0, 5))}\nActual rows (sample): ${JSON.stringify((actualRows || []).slice(0, 5))}`}

Review the query now. recommendedQuery should be a correct, well-written professional solution to this exact problem.`;

  return callAI({ system: SQL_REVIEW_SYSTEM_PROMPT, prompt: userPrompt, schema: SqlReviewSchema, jsonSchema: SqlReviewJsonSchema });
}

// ---------------------------------------------------------------------
// Resume-based question generation (section 26).
// ---------------------------------------------------------------------
const ResumeQuestionsSchema = z.object({
  questions: z.array(
    z.object({
      question: z.string(),
      relatedClaim: z.string(),
      category: z.string(),
      difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced', 'Expert']),
      whatAGoodAnswerCovers: z.array(z.string()),
    })
  ),
});

const ResumeQuestionsJsonSchema = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          relatedClaim: { type: 'string' },
          category: { type: 'string' },
          difficulty: { type: 'string', enum: ['Beginner', 'Intermediate', 'Advanced', 'Expert'] },
          whatAGoodAnswerCovers: { type: 'array', items: { type: 'string' } },
        },
        required: ['question', 'relatedClaim', 'category', 'difficulty', 'whatAGoodAnswerCovers'],
      },
    },
  },
  required: ['questions'],
};

const RESUME_SYSTEM_PROMPT = `You are a senior interviewer preparing to grill a candidate on their own resume. For every significant claim on the resume - a project, a tool/technology, a metric/result, a responsibility - generate a pointed interview question that would expose whether the claim is real depth or padding. Cover the standard resume-defense angles across the set as a whole: why they built something, why they chose a given architecture/model/tool, what alternatives they considered, what problems they hit and how they debugged them, their specific individual contribution (especially if it sounds like team work), how they evaluated success, what they'd change now, how they'd scale it, and what would break in production. Generate 8-15 questions depending on how much substantive content is in the resume. Skip generic filler (objective statements, soft-skill adjectives with no evidence) - focus on claims with technical or quantifiable substance.`;

async function generateResumeQuestions(resumeText) {
  const result = await callAI({
    system: RESUME_SYSTEM_PROMPT,
    prompt: `RESUME:\n"""\n${resumeText}\n"""\n\nGenerate the resume-defense questions now.`,
    schema: ResumeQuestionsSchema,
    jsonSchema: ResumeQuestionsJsonSchema,
  });
  return result.questions;
}

// ---------------------------------------------------------------------
// Job description gap analysis (section 27).
// ---------------------------------------------------------------------
const JobGapSchema = z.object({
  roleSummary: z.string(),
  gaps: z.array(
    z.object({
      requiredSkill: z.string(),
      currentLevel: z.string(),
      requiredLevel: z.string(),
      gap: z.string(),
      priority: z.enum(['High', 'Medium', 'Low']),
      recommendedAction: z.string(),
    })
  ),
  overallFitSummary: z.string(),
});

const JobGapJsonSchema = {
  type: 'object',
  properties: {
    roleSummary: { type: 'string' },
    gaps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          requiredSkill: { type: 'string' },
          currentLevel: { type: 'string' },
          requiredLevel: { type: 'string' },
          gap: { type: 'string' },
          priority: { type: 'string', enum: ['High', 'Medium', 'Low'] },
          recommendedAction: { type: 'string' },
        },
        required: ['requiredSkill', 'currentLevel', 'requiredLevel', 'gap', 'priority', 'recommendedAction'],
      },
    },
    overallFitSummary: { type: 'string' },
  },
  required: ['roleSummary', 'gaps', 'overallFitSummary'],
};

const JOBMATCH_SYSTEM_PROMPT = `You are a career coach comparing a job description against a candidate's current measured skill levels (0-100% per skill area, derived from their actual practice data - not self-reported). For every meaningfully distinct required skill/technology mentioned in the JD, produce a gap row: requiredSkill (short label), currentLevel (their measured % if it maps to a tracked skill area, otherwise "Unknown/Untracked"), requiredLevel (your estimate of the bar this role expects, as a qualitative level like "Working knowledge" / "Strong" / "Expert"), gap (a one-sentence honest description of the delta), priority (High/Medium/Low - how much this specific gap would hurt them in this specific role's interviews), and recommendedAction (one concrete, specific next step). Be realistic, not encouraging-by-default - a 20% skill against a role that needs strong proficiency is a real gap and should say so.`;

async function analyzeJobDescription({ jobDescriptionText, readinessBreakdown }) {
  const userPrompt = `JOB DESCRIPTION:
"""
${jobDescriptionText}
"""

CANDIDATE'S CURRENT MEASURED SKILL LEVELS (0-100%, from actual practice/interview data):
${JSON.stringify(readinessBreakdown, null, 2)}

Produce the gap analysis now.`;

  return callAI({ system: JOBMATCH_SYSTEM_PROMPT, prompt: userPrompt, schema: JobGapSchema, jsonSchema: JobGapJsonSchema });
}

// ---------------------------------------------------------------------
// System design practice review. Free-text design write-up, so unlike
// code/SQL practice there's no executable correctness check - the model
// judges the write-up itself against the problem's stated evaluation focus.
// ---------------------------------------------------------------------
const SystemDesignReviewSchema = z.object({
  requirementsScore: z.number().int().min(0).max(10),
  architectureScore: z.number().int().min(0).max(10),
  scalabilityScore: z.number().int().min(0).max(10),
  tradeoffsScore: z.number().int().min(0).max(10),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  suggestions: z.array(z.string()),
  interviewerRemark: z.string(),
});

const SystemDesignReviewJsonSchema = {
  type: 'object',
  properties: {
    requirementsScore: { type: 'integer' },
    architectureScore: { type: 'integer' },
    scalabilityScore: { type: 'integer' },
    tradeoffsScore: { type: 'integer' },
    strengths: { type: 'array', items: { type: 'string' } },
    gaps: { type: 'array', items: { type: 'string' } },
    suggestions: { type: 'array', items: { type: 'string' } },
    interviewerRemark: { type: 'string' },
  },
  required: ['requirementsScore', 'architectureScore', 'scalabilityScore', 'tradeoffsScore', 'strengths', 'gaps', 'suggestions', 'interviewerRemark'],
};

const SYSTEM_DESIGN_SYSTEM_PROMPT = `You are a senior staff engineer at a top-tier tech company running a system design interview, the way a bar-raiser would. The candidate has written up their design for the given problem as free text (no diagram tool available, so ASCII/prose descriptions of components are normal and should not be penalized on presentation alone). You are given the problem's stated functional/non-functional requirements and evaluation focus areas (what this specific problem is designed to test) as reference - the candidate did not see the evaluation focus list.

Calibration - this determines a hire/no-hire signal, not a participation grade:
- requirementsScore: did they clarify scope and state functional/non-functional requirements (scale, latency, consistency needs) before designing, or jump straight to a solution with unstated assumptions? A design with no stated requirements/assumptions caps here around 3-4 regardless of how good the architecture is, because a real interviewer would stop them and ask.
- architectureScore: is the high-level design (components, data flow, API/data model) coherent and does it actually solve the stated problem, not a generic template pasted in regardless of the specifics asked?
- scalabilityScore: did they address the problem's specific scaling pressure point (the thing named in evaluationFocus) with a real mechanism, not just the word "scalable" or "we'd use a load balancer" with no specifics?
- tradeoffsScore: did they articulate real trade-offs (e.g. consistency vs availability, latency vs cost, simplicity vs correctness) and justify choices, rather than presenting one option as if it were the only possibility?
- A design that is well-organized and confident-sounding but generic (could be pasted onto any system-design question unchanged) should score low on scalabilityScore and tradeoffsScore specifically, even if architectureScore is decent - genericness is exactly what a real bar-raiser penalizes.
- Compare explicitly against the reference approach's key ideas (given to you, not the candidate) - if the candidate missed the central insight the problem is testing (e.g. the celebrity fan-out problem, or point-in-time correctness), say so directly in gaps, don't just vaguely note "could go deeper."
- interviewerRemark: 1-2 sentences in the interviewer's voice, direct and unsentimental about whether this would pass a real loop at this difficulty level.
- Never be sycophantic. A generic or shallow answer should read as generic or shallow in the feedback, not be softened.`;

async function evaluateSystemDesign({ problem, answerText }) {
  const userPrompt = `PROBLEM: ${problem.title}
DIFFICULTY: ${problem.difficulty} | TOPIC: ${problem.topic}
PROMPT: ${problem.prompt}

FUNCTIONAL REQUIREMENTS (reference): ${(problem.functionalRequirements || []).join('; ')}
NON-FUNCTIONAL REQUIREMENTS (reference): ${(problem.nonFunctionalRequirements || []).join('; ')}
EVALUATION FOCUS FOR THIS PROBLEM (reference, not shown to candidate): ${(problem.evaluationFocus || []).join('; ')}
REFERENCE APPROACH (reference, not shown to candidate): ${problem.referenceApproach}

CANDIDATE'S DESIGN WRITE-UP:
"""
${answerText || '(no answer given)'}
"""

Review the design now.`;

  return callAI({ system: SYSTEM_DESIGN_SYSTEM_PROMPT, prompt: userPrompt, schema: SystemDesignReviewSchema, jsonSchema: SystemDesignReviewJsonSchema });
}

// ---------------------------------------------------------------------
// Resume builder: per-bullet/summary rewriting and a holistic resume
// review, as distinct from resume-defense question generation above.
// ---------------------------------------------------------------------
const ImprovedTextSchema = z.object({
  improved: z.string(),
  reasoning: z.string(),
});

const ImprovedTextJsonSchema = {
  type: 'object',
  properties: {
    improved: { type: 'string' },
    reasoning: { type: 'string' },
  },
  required: ['improved', 'reasoning'],
};

const IMPROVE_BULLET_SYSTEM_PROMPT = `You are a professional resume writer who has reviewed thousands of resumes for technical/data roles and knows exactly what gets a candidate past an ATS filter and a 6-second human skim. Rewrite the given resume bullet (or summary paragraph) to be sharper and more impactful, following these rules:
- Lead with a strong action verb (Built, Led, Reduced, Designed, Shipped, Optimized) - never "Responsible for" or "Worked on".
- Quantify impact wherever plausible (%, time saved, scale, revenue, users) - if the original has no numbers and none are implied, improve the phrasing/specificity without inventing fake metrics; flag in reasoning that a real number should be added here.
- Be concise - one line, no filler words ("various", "a variety of", "in order to").
- Use concrete technical nouns instead of vague ones ("built a caching layer that cut API latency" beats "improved performance").
- Keep it truthful to the original content - improve phrasing and structure, don't fabricate achievements, technologies, or scope that weren't in the original.
Return the improved text plus a one-sentence reasoning note explaining the single biggest change you made and why.`;

async function improveResumeText({ text, sectionType, targetRole }) {
  const userPrompt = `SECTION TYPE: ${sectionType || 'resume bullet'}
${targetRole ? `TARGET ROLE: ${targetRole}` : ''}

ORIGINAL TEXT:
"""
${text}
"""

Rewrite it now.`;

  return callAI({ system: IMPROVE_BULLET_SYSTEM_PROMPT, prompt: userPrompt, schema: ImprovedTextSchema, jsonSchema: ImprovedTextJsonSchema });
}

const ResumeReviewSchema = z.object({
  overallScore: z.number().int().min(0).max(10),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  missingKeywords: z.array(z.string()),
  suggestions: z.array(z.string()),
});

const ResumeReviewJsonSchema = {
  type: 'object',
  properties: {
    overallScore: { type: 'integer' },
    strengths: { type: 'array', items: { type: 'string' } },
    gaps: { type: 'array', items: { type: 'string' } },
    missingKeywords: { type: 'array', items: { type: 'string' } },
    suggestions: { type: 'array', items: { type: 'string' } },
  },
  required: ['overallScore', 'strengths', 'gaps', 'missingKeywords', 'suggestions'],
};

const RESUME_REVIEW_SYSTEM_PROMPT = `You are a senior technical recruiter reviewing a resume draft for a specific target role, the way a real recruiter doing a 6-second skim followed by a closer read would. Judge holistically: quantified impact vs vague responsibilities, whether the summary and skills actually match the target role, ATS-friendliness (clear section structure, standard terminology, no walls of unquantified text), and whether the experience section tells a coherent growth story. overallScore should be calibrated like a real screen - a resume with mostly unquantified "responsible for" bullets and a generic summary is a 3-4, not a 6-7, even if the underlying experience is solid, because the writing is actively hiding the candidate's value. missingKeywords should name specific skills/technologies the target role likely expects that don't appear anywhere in the resume. Don't be sycophantic - if it reads as generic or padded, say so plainly.`;

async function reviewResume({ resumeData, targetRole }) {
  const userPrompt = `TARGET ROLE: ${targetRole || '(not specified - evaluate for general data/ML industry fit)'}

RESUME DRAFT (JSON):
${JSON.stringify(resumeData, null, 2)}

Review this resume draft now.`;

  return callAI({ system: RESUME_REVIEW_SYSTEM_PROMPT, prompt: userPrompt, schema: ResumeReviewSchema, jsonSchema: ResumeReviewJsonSchema });
}

module.exports = {
  evaluateAnswer,
  generateCoachSummary,
  evaluateCode,
  evaluateSql,
  generateResumeQuestions,
  analyzeJobDescription,
  evaluateSystemDesign,
  improveResumeText,
  reviewResume,
  hasApiKey,
};
