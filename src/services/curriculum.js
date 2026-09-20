// Deterministic, template-driven curriculum + roadmap generator.
// Not LLM-generated: a study plan should be reliable, reproducible, and
// free, so this is authored content parameterized by track/duration/pace
// rather than a model call. Personalization (weak-topic emphasis, resume
// text, target companies) still comes from the user's profile.

const TRACKS = ['Data Scientist', 'ML Engineer', 'AI Engineer'];

// Canonical topic pool, tagged by which track(s) need it and which question
// bank / practice category it maps to. `weight` roughly indicates how many
// sessions a topic deserves relative to others in its phase.
const TOPICS = [
  // Foundations - all tracks
  { id: 'python-basics', label: 'Python Fundamentals (types, control flow, functions)', category: 'Python', tracks: ['Data Scientist', 'ML Engineer', 'AI Engineer'], phase: 1 },
  { id: 'python-oop', label: 'Python OOP (classes, self, __init__, inheritance)', category: 'Python', tracks: ['Data Scientist', 'ML Engineer', 'AI Engineer'], phase: 1 },
  { id: 'python-advanced', label: 'Python Advanced (iterators, generators, decorators, context managers)', category: 'Python', tracks: ['ML Engineer', 'AI Engineer'], phase: 2 },
  { id: 'numpy-pandas', label: 'NumPy & Pandas', category: 'Data Analysis', tracks: ['Data Scientist', 'ML Engineer', 'AI Engineer'], phase: 1 },
  { id: 'git', label: 'Git & Version Control', category: 'Python', tracks: ['Data Scientist', 'ML Engineer', 'AI Engineer'], phase: 1 },

  // Math & Stats - all tracks
  { id: 'math-linalg', label: 'Linear Algebra (vectors, matrices, eigenvalues)', category: 'Math - Linear Algebra', tracks: ['Data Scientist', 'ML Engineer', 'AI Engineer'], phase: 1 },
  { id: 'math-calc', label: 'Calculus & Optimization (gradients, chain rule)', category: 'Math - Calculus & Optimization', tracks: ['Data Scientist', 'ML Engineer', 'AI Engineer'], phase: 1 },
  { id: 'math-prob', label: 'Probability & Statistics', category: 'Math - Probability & Statistics', tracks: ['Data Scientist', 'ML Engineer', 'AI Engineer'], phase: 1 },
  { id: 'math-info', label: 'Information Theory (entropy, KL divergence)', category: 'Math - Information Theory', tracks: ['Data Scientist', 'ML Engineer', 'AI Engineer'], phase: 2 },

  // SQL & Data Analysis
  { id: 'sql-basics', label: 'SQL Fundamentals (SELECT, JOIN, GROUP BY)', category: 'SQL', tracks: ['Data Scientist', 'ML Engineer', 'AI Engineer'], phase: 1 },
  { id: 'sql-advanced', label: 'Advanced SQL (window functions, CTEs, optimization)', category: 'SQL', tracks: ['Data Scientist', 'ML Engineer', 'AI Engineer'], phase: 2 },
  { id: 'eda', label: 'Exploratory Data Analysis & Data Cleaning', category: 'Data Analysis', tracks: ['Data Scientist', 'ML Engineer'], phase: 1 },

  // Coding / DSA - all tracks
  { id: 'dsa-basics', label: 'DSA: Arrays, Strings, Hash Maps', category: 'Coding & DSA', tracks: ['Data Scientist', 'ML Engineer', 'AI Engineer'], phase: 1 },
  { id: 'dsa-intermediate', label: 'DSA: Two Pointers, Sliding Window, Binary Search', category: 'Coding & DSA', tracks: ['Data Scientist', 'ML Engineer', 'AI Engineer'], phase: 2 },
  { id: 'dsa-advanced', label: 'DSA: Trees, Graphs, Dynamic Programming', category: 'Coding & DSA', tracks: ['ML Engineer', 'AI Engineer'], phase: 3 },

  // Machine Learning
  { id: 'ml-supervised', label: 'Supervised Learning (regression, trees, boosting)', category: 'Machine Learning', tracks: ['Data Scientist', 'ML Engineer', 'AI Engineer'], phase: 2 },
  { id: 'ml-unsupervised', label: 'Unsupervised Learning (clustering, PCA)', category: 'Machine Learning', tracks: ['Data Scientist', 'ML Engineer'], phase: 2 },
  { id: 'ml-eval', label: 'Model Evaluation & Metrics', category: 'Machine Learning', tracks: ['Data Scientist', 'ML Engineer', 'AI Engineer'], phase: 2 },
  { id: 'ml-scratch', label: 'Implement ML Algorithms From Scratch (NumPy)', category: 'Machine Learning', tracks: ['Data Scientist', 'ML Engineer'], phase: 2 },
  { id: 'ab-testing', label: 'Experimentation & A/B Testing', category: 'Data Analysis', tracks: ['Data Scientist'], phase: 3 },

  // Deep Learning
  { id: 'dl-fundamentals', label: 'Deep Learning Fundamentals (backprop, optimizers)', category: 'Deep Learning', tracks: ['Data Scientist', 'ML Engineer', 'AI Engineer'], phase: 3 },
  { id: 'dl-architectures', label: 'CNNs, RNNs, LSTMs', category: 'Deep Learning', tracks: ['ML Engineer', 'AI Engineer'], phase: 3 },
  { id: 'transformers', label: 'Attention & Transformers', category: 'Deep Learning', tracks: ['ML Engineer', 'AI Engineer'], phase: 3 },

  // LLM / GenAI - mainly AI Engineer, relevant to all
  { id: 'llm-fundamentals', label: 'LLM Fundamentals (tokenization, embeddings)', category: 'Generative AI / LLMs', tracks: ['Data Scientist', 'ML Engineer', 'AI Engineer'], phase: 3 },
  { id: 'prompting', label: 'Prompt Engineering & Structured Outputs', category: 'Generative AI / LLMs', tracks: ['Data Scientist', 'ML Engineer', 'AI Engineer'], phase: 3 },
  { id: 'rag', label: 'RAG (chunking, retrieval, reranking, evaluation)', category: 'Generative AI / LLMs', tracks: ['ML Engineer', 'AI Engineer'], phase: 4 },
  { id: 'finetuning', label: 'Fine-tuning, LoRA & PEFT', category: 'Generative AI / LLMs', tracks: ['ML Engineer', 'AI Engineer'], phase: 4 },
  { id: 'agents', label: 'AI Agents & Tool Calling', category: 'Generative AI / LLMs', tracks: ['AI Engineer'], phase: 4 },

  // MLOps / Engineering
  { id: 'mlops-serving', label: 'Model Serving & Deployment', category: 'MLOps', tracks: ['ML Engineer', 'AI Engineer'], phase: 4 },
  { id: 'mlops-pipelines', label: 'MLOps Pipelines, Monitoring, CI/CD', category: 'MLOps', tracks: ['ML Engineer', 'AI Engineer'], phase: 4 },
  { id: 'apis-backend', label: 'APIs & Backend Fundamentals', category: 'MLOps', tracks: ['ML Engineer', 'AI Engineer'], phase: 2 },

  // System Design
  { id: 'sysdesign-general', label: 'General System Design Fundamentals', category: 'System Design', tracks: ['Data Scientist', 'ML Engineer', 'AI Engineer'], phase: 3 },
  { id: 'sysdesign-ml', label: 'ML System Design (recsys, fraud, ranking)', category: 'System Design', tracks: ['Data Scientist', 'ML Engineer'], phase: 4 },
  { id: 'sysdesign-ai', label: 'AI System Design (RAG, agents, LLM serving)', category: 'System Design', tracks: ['AI Engineer'], phase: 4 },

  // Business / Case studies / Behavioral - all tracks
  { id: 'case-studies', label: 'Data Science Case Studies & Business Understanding', category: 'Data Analysis', tracks: ['Data Scientist'], phase: 3 },
  { id: 'behavioral', label: 'Behavioral & STAR Communication', category: 'Behavioral/HR', tracks: ['Data Scientist', 'ML Engineer', 'AI Engineer'], phase: 1 },

  // Projects
  { id: 'project-1', label: 'Project: Data Analysis', category: 'Projects', tracks: ['Data Scientist', 'ML Engineer', 'AI Engineer'], phase: 1 },
  { id: 'project-2', label: 'Project: End-to-End ML Pipeline', category: 'Projects', tracks: ['Data Scientist', 'ML Engineer'], phase: 2 },
  { id: 'project-3', label: 'Project: Deep Learning Model', category: 'Projects', tracks: ['ML Engineer', 'AI Engineer'], phase: 3 },
  { id: 'project-4', label: 'Project: LLM/RAG Application', category: 'Projects', tracks: ['AI Engineer', 'ML Engineer'], phase: 4 },
  { id: 'capstone', label: 'Capstone: Production-Style AI/ML System', category: 'Projects', tracks: ['Data Scientist', 'ML Engineer', 'AI Engineer'], phase: 5 },
];

// Weekly day-role template (section 22). Sunday is always a mock interview +
// weekly evaluation regardless of phase.
const WEEK_TEMPLATE = [
  { dayOfWeek: 'Monday', role: 'Foundation + Coding', activityTypes: ['learn', 'code', 'submit', 'evaluate'] },
  { dayOfWeek: 'Tuesday', role: 'Statistics / Mathematics + Interview', activityTypes: ['learn', 'understand', 'interview', 'communicate'] },
  { dayOfWeek: 'Wednesday', role: 'SQL + Data Analysis', activityTypes: ['code', 'solve', 'submit'] },
  { dayOfWeek: 'Thursday', role: 'Machine Learning', activityTypes: ['learn', 'understand', 'interview'] },
  { dayOfWeek: 'Friday', role: 'ML Coding + Communication', activityTypes: ['code', 'communicate', 'submit'] },
  { dayOfWeek: 'Saturday', role: 'Project + System Design', activityTypes: ['solve', 'submit', 'evaluate'] },
  { dayOfWeek: 'Sunday', role: 'Full Mock Interview + Weekly Evaluation', activityTypes: ['mock', 'evaluate', 'revise'] },
];

const ACTIVITY_TASK_BUILDERS = {
  learn: (topic, hoursPerDay) => ({
    type: 'learn',
    topic: topic.label,
    category: topic.category,
    description: `Study ${topic.label}. Read/watch a primer, then write your own notes in your own words - don't just highlight someone else's explanation.`,
  }),
  understand: (topic) => ({
    type: 'understand',
    topic: topic.label,
    category: topic.category,
    description: `Without looking at references, write out answers to: "What is ${topic.label}?", "Why does it matter?", and "What's a common mistake people make with it?"`,
  }),
  code: (topic, hoursPerDay) => ({
    type: 'code',
    topic: topic.label,
    category: topic.category,
    description: `Write code applying ${topic.label} - ${topic.category === 'SQL' ? 'solve ' + Math.max(2, Math.round(hoursPerDay)) + ' SQL problems on the Practice page' : topic.category === 'Coding & DSA' ? 'solve ' + Math.max(2, Math.round(hoursPerDay)) + ' coding problems on the Practice page' : 'implement a small working example from scratch, no copy-pasting'}.`,
    link: topic.category === 'SQL' || topic.category === 'Coding & DSA' ? `practice.html?category=${encodeURIComponent(topic.category)}` : null,
  }),
  solve: (topic) => ({
    type: 'solve',
    topic: topic.label,
    category: topic.category,
    description: `Apply ${topic.label} to a practical problem or dataset - don't stop at the toy example, push it toward something realistic.`,
  }),
  interview: (topic, hoursPerDay) => ({
    type: 'interview',
    topic: topic.label,
    category: topic.category,
    description: `Answer ${Math.max(3, Math.round(hoursPerDay * 2))} interview questions on ${topic.label} via the mock interview (voice or typed).`,
    link: `index.html?category=${encodeURIComponent(topic.category)}`,
  }),
  communicate: (topic) => ({
    type: 'communicate',
    topic: topic.label,
    category: topic.category,
    description: `Explain ${topic.label} out loud in under 90 seconds as if to an interviewer - definition, why it matters, one example.`,
  }),
  submit: (topic) => ({
    type: 'submit',
    topic: topic.label,
    category: topic.category,
    description: `Submit today's work (code / SQL / written explanation) for AI evaluation.`,
  }),
  evaluate: () => ({
    type: 'evaluate',
    description: `Review today's AI feedback. Note anything you got wrong or explained poorly.`,
  }),
  revise: () => ({
    type: 'revise',
    description: `Revisit this week's weakest topic (see your Dashboard's "due for review" list) before starting next week.`,
    link: 'dashboard.html',
  }),
  mock: (topic) => ({
    type: 'mock',
    topic: topic ? topic.label : 'Mixed',
    category: topic ? topic.category : 'Mixed',
    description: `Full mock interview session covering this week's topics, then read your weekly report.`,
    link: 'index.html',
  }),
};

function getTopicsForTrack(track, maxPhase) {
  return TOPICS.filter((t) => t.tracks.includes(track) && t.phase <= maxPhase);
}

/**
 * Splits total weeks into N phases (matching the Month 1/2/3 or Month 1-6
 * breakdowns in sections 23/24), and returns the topic pool unlocked by
 * each phase.
 */
function buildPhases(totalWeeks, numPhases) {
  const weeksPerPhase = Math.ceil(totalWeeks / numPhases);
  const phases = [];
  for (let p = 1; p <= numPhases; p++) {
    const startWeek = (p - 1) * weeksPerPhase + 1;
    const endWeek = Math.min(p * weeksPerPhase, totalWeeks);
    if (startWeek > totalWeeks) break;
    phases.push({ phaseNumber: p, startWeek, endWeek });
  }
  return phases;
}

/**
 * Generates a full roadmap: an array of weeks, each with 7 days, each day
 * with a small set of concrete tasks (not just a topic name). Deterministic
 * given the same profile - re-generating with the same inputs reproduces
 * the same plan, so it's safe to regenerate after an onboarding edit.
 */
function generateRoadmap(profile) {
  const { track, planLength, startDate, hoursPerDay, weaknesses = [] } = profile;
  if (!TRACKS.includes(track)) throw new Error(`Unknown track: ${track}`);

  const totalWeeks = planLength === '6-month' ? 26 : 13;
  const numPhases = planLength === '6-month' ? 6 : 3;
  const maxTopicPhase = planLength === '6-month' ? 5 : 4;
  const phases = buildPhases(totalWeeks, numPhases);

  const allTopics = getTopicsForTrack(track, maxTopicPhase);
  // Weak topics (from onboarding or from mastery data) get pulled earlier
  // and repeated more often by sorting them first within their phase.
  const weightedTopics = [...allTopics].sort((a, b) => {
    const aWeak = weaknesses.some((w) => a.label.toLowerCase().includes(w.toLowerCase()) || a.category.toLowerCase().includes(w.toLowerCase()));
    const bWeak = weaknesses.some((w) => b.label.toLowerCase().includes(w.toLowerCase()) || b.category.toLowerCase().includes(w.toLowerCase()));
    if (aWeak === bWeak) return a.phase - b.phase;
    return aWeak ? -1 : 1;
  });

  const weeks = [];
  let cursor = new Date(startDate);
  let topicPointer = 0;

  const phaseForWeek = (weekNum) => phases.find((p) => weekNum >= p.startWeek && weekNum <= p.endWeek) || phases[phases.length - 1];
  const topicsInPhase = (phaseNumber) => weightedTopics.filter((t) => t.phase === Math.min(phaseNumber, maxTopicPhase));

  for (let weekNum = 1; weekNum <= totalWeeks; weekNum++) {
    const phase = phaseForWeek(weekNum);
    let phaseTopics = topicsInPhase(phase.phaseNumber);
    if (phaseTopics.length === 0) phaseTopics = weightedTopics; // fallback so we never run dry

    const days = [];
    for (const dayTemplate of WEEK_TEMPLATE) {
      const dateStr = cursor.toISOString().slice(0, 10);
      const dayTasks = [];
      for (const activity of dayTemplate.activityTypes) {
        const topic = phaseTopics[topicPointer % phaseTopics.length];
        const builder = ACTIVITY_TASK_BUILDERS[activity];
        dayTasks.push(builder(topic, hoursPerDay || 2));
        // Advance the topic pointer roughly once per day (not per task) so
        // a whole day stays thematically coherent - only bump after the
        // "learn"/"code"/"interview"/"mock" tasks that anchor the topic.
        if (['learn', 'code', 'interview', 'mock'].includes(activity)) topicPointer++;
      }
      days.push({
        date: dateStr,
        dayOfWeek: dayTemplate.dayOfWeek,
        role: dayTemplate.role,
        tasks: dayTasks,
        completed: false,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    weeks.push({
      weekNumber: weekNum,
      phaseNumber: phase.phaseNumber,
      theme: phaseThemeLabel(track, planLength, phase.phaseNumber),
      days,
    });
  }

  return {
    track,
    planLength,
    startDate,
    hoursPerDay,
    generatedAt: new Date().toISOString(),
    weeks,
  };
}

function phaseThemeLabel(track, planLength, phaseNumber) {
  const labels3 = {
    1: 'Month 1 - Foundations (Python, SQL, Stats, EDA, Basic ML)',
    2: 'Month 2 - Machine Learning & Deep Learning Fundamentals',
    3: 'Month 3 - LLM/AI Engineering, System Design, Projects & Job Prep',
  };
  const labels6 = {
    1: 'Month 1 - Programming + Mathematics + SQL',
    2: 'Month 2 - Statistics + Data Analysis + Machine Learning',
    3: 'Month 3 - Advanced ML + Deep Learning',
    4: 'Month 4 - Transformers + LLMs + RAG + AI Engineering',
    5: 'Month 5 - MLOps + System Design + Production AI',
    6: 'Month 6 - Advanced Projects + Interview Preparation + Job Applications',
  };
  const label = planLength === '6-month' ? labels6[phaseNumber] : labels3[phaseNumber];
  return label || `Phase ${phaseNumber}`;
}

module.exports = { TRACKS, TOPICS, generateRoadmap, getTopicsForTrack };
