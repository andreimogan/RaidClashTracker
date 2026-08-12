#!/usr/bin/env node
'use strict';
/**
 * token-report — what this session cost, and whether the cache is holding.
 *
 *   node .claude/scripts/token-report.js              # report on this project's newest session
 *   node .claude/scripts/token-report.js <file.jsonl> # a specific transcript
 *   node .claude/scripts/token-report.js --line       # one line, for docs/build-log.md
 *   node .claude/scripts/token-report.js --budget     # subscription windows, no transcript needed
 *   node .claude/scripts/token-report.js --plan-cost  # what creating the current plan cost
 *   node .claude/scripts/token-report.js --plan-cost --solo   # ... on an order planned without the planner
 *   node .claude/scripts/token-report.js --json       # machine-readable
 *
 * Zero dependencies, Node only. Reads Claude Code's session transcript, which
 * is an internal undocumented format — everything here degrades rather than
 * throws, and `--json` is the contract for anything built on top.
 *
 * Two parsing rules are load-bearing; do not undo them:
 *
 *  1. ONE RESPONSE SPANS SEVERAL LINES, each repeating the same `message.usage`.
 *     Summing naively over-counts by ~2.2x. Usage is deduped by `requestId`,
 *     first line wins, so a turn's cost belongs to the moment it started.
 *  2. SUBAGENT TURNS ARE MARKED `isSidechain: true`. Main-session and subagent
 *     costs must be separated: subagents start cold on a 5-minute TTL by
 *     design, so mixing them makes the main session's cache look worse than
 *     it is.
 *
 * Nothing reports a cache hit rate, so we compute it:
 *     read / (read + creation + input)
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

// Approximate list rates, USD per million tokens. Cache reads bill at 0.1x
// input; cache writes at 1.25x for the 5-minute TTL and 2x for the 1-hour one.
// Estimates for orientation — not a bill.
const PRICING = {
  'claude-fable-5': { input: 10, output: 50 },
  'claude-mythos-5': { input: 10, output: 50 },
  'claude-opus-5': { input: 5, output: 25 },
  'claude-opus-4-8': { input: 5, output: 25 },
  'claude-opus-4-7': { input: 5, output: 25 },
  'claude-opus-4-6': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 3, output: 15 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 },
};
const CACHE_READ_MULT = 0.1;
const CACHE_WRITE_MULT = { h1: 2.0, m5: 1.25 };

// An invalidation shows up as the cache read collapsing *relative to the
// request before it* while a large write rebuilds the prefix. Both conditions
// are required: incremental growth also writes cache, but without the read
// dropping. Comparing against the previous request rather than the session's
// peak matters — after a compaction the conversation is legitimately short
// again, and a peak-based comparison flags every later turn forever.
const SPIKE_MIN_WRITE = 10000;
const SPIKE_READ_RATIO = 0.5;

function priceFor(model) {
  if (!model) return null;
  if (PRICING[model]) return PRICING[model];
  const base = model.replace(/-\d{8}$/, '');
  return PRICING[base] || null;
}

function readJsonl(file) {
  const out = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { /* tolerate partial writes */ }
  }
  return out;
}

/** Newest transcript whose recorded cwd matches `dir`. */
function findSessionFor(dir, projectsRoot) {
  const root = projectsRoot || path.join(os.homedir(), '.claude', 'projects');
  if (!fs.existsSync(root)) return null;
  const want = path.resolve(dir).toLowerCase();
  let best = null;
  for (const d of fs.readdirSync(root)) {
    const abs = path.join(root, d);
    let entries;
    try {
      if (!fs.statSync(abs).isDirectory()) continue;
      entries = fs.readdirSync(abs).filter((f) => f.endsWith('.jsonl'));
    } catch { continue; }
    for (const f of entries) {
      const file = path.join(abs, f);
      let st;
      try { st = fs.statSync(file); } catch { continue; }
      if (best && st.mtimeMs <= best.mtimeMs) continue;
      let cwd = null;
      try {
        for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
          if (!line.trim()) continue;
          try { const o = JSON.parse(line); if (o.cwd) { cwd = o.cwd; break; } } catch { /* skip */ }
        }
      } catch { continue; }
      if (cwd && path.resolve(cwd).toLowerCase() === want) best = { file, mtimeMs: st.mtimeMs };
    }
  }
  return best && best.file;
}

const emptyTotals = () => ({
  input: 0, output: 0, cacheRead: 0, cacheWrite: 0, ttl1h: 0, ttl5m: 0, requests: 0,
});

function addUsage(t, u) {
  t.input += u.input_tokens || 0;
  t.output += u.output_tokens || 0;
  t.cacheRead += u.cache_read_input_tokens || 0;
  t.cacheWrite += u.cache_creation_input_tokens || 0;
  const c = u.cache_creation || {};
  t.ttl1h += c.ephemeral_1h_input_tokens || 0;
  t.ttl5m += c.ephemeral_5m_input_tokens || 0;
  t.requests += 1;
  return t;
}

/** read / (read + write + input). Null when there is no input at all. */
function hitRate(t) {
  const denom = t.cacheRead + t.cacheWrite + t.input;
  return denom ? t.cacheRead / denom : null;
}

function costOf(t, model) {
  const p = priceFor(model);
  if (!p) return null;
  const writeMult = t.ttl1h >= t.ttl5m ? CACHE_WRITE_MULT.h1 : CACHE_WRITE_MULT.m5;
  return (t.input * p.input
    + t.output * p.output
    + t.cacheRead * p.input * CACHE_READ_MULT
    + t.cacheWrite * p.input * writeMult) / 1e6;
}

/**
 * The whole analysis. Exported so the debug harness can assert that it and this
 * script produce identical numbers from the same transcript.
 */
function analyze(lines) {
  const seen = new Set();
  const main = emptyTotals();
  const sub = emptyTotals();
  const byModel = new Map();
  const series = [];
  const agents = new Map();
  let firstAt = null; let lastAt = null;

  for (const o of lines) {
    if (o.timestamp) {
      if (!firstAt || o.timestamp < firstAt) firstAt = o.timestamp;
      if (!lastAt || o.timestamp > lastAt) lastAt = o.timestamp;
    }

    const r = o.toolUseResult;
    if (r && r.agentType) {
      const a = agents.get(r.agentType) || { dispatches: 0, tokens: 0, toolUses: 0 };
      a.dispatches += 1;
      a.tokens += r.totalTokens || 0;
      a.toolUses += r.totalToolUseCount || 0;
      agents.set(r.agentType, a);
    }

    const m = o.message;
    if (!m || !m.usage || o.type !== 'assistant') continue;
    if (m.model === '<synthetic>') continue;
    const key = o.requestId || `uuid:${o.uuid}`;
    if (seen.has(key)) continue;      // rule 1: one response, many lines
    seen.add(key);

    const bucket = o.isSidechain ? sub : main;   // rule 2: never mix the two
    addUsage(bucket, m.usage);

    if (m.model) {
      const mm = byModel.get(m.model) || emptyTotals();
      byModel.set(m.model, addUsage(mm, m.usage));
    }

    if (!o.isSidechain) {
      series.push({
        at: o.timestamp || null,
        model: m.model || null,
        read: m.usage.cache_read_input_tokens || 0,
        write: m.usage.cache_creation_input_tokens || 0,
      });
    }
  }

  // Invalidation forensics. The first request legitimately builds the prefix,
  // so warm-up is excluded. After that, a big write paired with a read that
  // collapsed against the previous request means the prefix was thrown away.
  // Where the transcript can prove the cause we say so; otherwise we list the
  // candidates rather than guess.
  const invalidations = [];
  for (let i = 1; i < series.length; i++) {
    const s = series[i];
    const prev = series[i - 1];
    if (s.write < SPIKE_MIN_WRITE) continue;
    if (s.read >= prev.read * SPIKE_READ_RATIO) continue;
    const cause = s.model && prev.model && s.model !== prev.model
      ? `model switch (${prev.model} → ${s.model})`
      : null;
    invalidations.push({
      at: s.at, index: i, cause, model: s.model,
      cacheWrite: s.write, cacheRead: s.read, priorRead: prev.read,
    });
  }

  const combined = emptyTotals();
  for (const t of [main, sub]) {
    for (const k of Object.keys(combined)) combined[k] += t[k];
  }

  let cost = 0; let priced = true;
  for (const [model, t] of byModel) {
    const c = costOf(t, model);
    if (c === null) { priced = false; continue; }
    cost += c;
  }

  const ttl = combined.ttl1h && combined.ttl5m ? 'mixed' : (combined.ttl1h ? '1h' : (combined.ttl5m ? '5m' : 'unknown'));

  return {
    totals: combined,
    main,
    sub,
    totalTokens: combined.input + combined.output + combined.cacheRead + combined.cacheWrite,
    hitRate: hitRate(combined),
    mainHitRate: hitRate(main),
    subHitRate: hitRate(sub),
    ttl,
    estimatedCostUsd: priced ? cost : null,
    models: [...byModel.keys()],
    agents: [...agents.entries()].map(([type, a]) => ({ type, ...a })).sort((x, y) => y.tokens - x.tokens),
    invalidations,
    startedAt: firstAt,
    endedAt: lastAt,
  };
}

// --- budget -----------------------------------------------------------------

/**
 * Read the samples `statusline-cache.js` recorded. Those samples are the only
 * programmatic view of the subscription rate limits — Claude Code hands the
 * figures to the status line and nowhere else — so everything here degrades to
 * "unknown" rather than guessing when the file is missing or stale.
 */
function readBudgetState(projectDir) {
  const file = process.env.ATS_BUDGET_STATE
    || path.join(projectDir || process.cwd(), '.claude', 'budget-state.json');
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    const samples = Array.isArray(parsed.samples) ? parsed.samples : [];
    if (!samples.length) return { available: false, reason: 'no samples recorded yet', file };
    return { available: true, file, samples, latest: samples[samples.length - 1] };
  } catch {
    return {
      available: false,
      file,
      reason: 'no budget samples yet — the status line records them, so it needs to have rendered at least once',
    };
  }
}

/**
 * Tokens consumed per percentage point of the five-hour window, derived from
 * this machine's own samples: take the token spend between two samples and
 * divide by how much the window moved. Needs the window to have moved without
 * resetting, so it returns null until that has happened.
 */
function tokensPerPercent(state, tokensBetween) {
  if (!state.available || state.samples.length < 2) return null;
  const pairs = [];
  for (let i = 1; i < state.samples.length; i++) {
    const a = state.samples[i - 1];
    const b = state.samples[i];
    const delta = (b.fiveHourPct || 0) - (a.fiveHourPct || 0);
    if (delta <= 0) continue;                       // reset, or idle
    if (a.fiveHourResetsAt !== b.fiveHourResetsAt) continue;  // different window
    const spent = tokensBetween(a.at, b.at);
    if (spent > 0) pairs.push(spent / delta);
  }
  if (!pairs.length) return null;
  pairs.sort((x, y) => x - y);
  return pairs[Math.floor(pairs.length / 2)];       // median resists one odd turn
}

/** Total tokens across this machine's transcripts within a time range. */
function tokensInRange(fromMs, toMs, projectsRoot) {
  const root = projectsRoot || path.join(os.homedir(), '.claude', 'projects');
  let total = 0;
  let dirs = [];
  try { dirs = fs.readdirSync(root); } catch { return 0; }
  for (const d of dirs) {
    const abs = path.join(root, d);
    let files = [];
    try {
      if (!fs.statSync(abs).isDirectory()) continue;
      files = fs.readdirSync(abs).filter((f) => f.endsWith('.jsonl'));
    } catch { continue; }
    for (const f of files) {
      const file = path.join(abs, f);
      try {
        // Cheap prefilter: a transcript last written before the range started
        // cannot contain turns inside it.
        if (fs.statSync(file).mtimeMs < fromMs) continue;
      } catch { continue; }
      const seen = new Set();
      for (const o of readJsonl(file)) {
        const m = o.message;
        if (!m || !m.usage || o.type !== 'assistant' || m.model === '<synthetic>') continue;
        const key = o.requestId || `uuid:${o.uuid}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const t = o.timestamp ? Date.parse(o.timestamp) : NaN;
        if (!(t >= fromMs && t <= toMs)) continue;
        const u = m.usage;
        total += (u.input_tokens || 0) + (u.output_tokens || 0)
          + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
      }
    }
  }
  return total;
}

function budgetReport(projectDir) {
  const state = readBudgetState(projectDir);
  if (!state.available) return { available: false, reason: state.reason, file: state.file };
  const s = state.latest;
  const ageMs = Date.now() - s.at;
  return {
    available: true,
    file: state.file,
    ageMs,
    stale: ageMs > 30 * 60 * 1000,
    fiveHour: {
      usedPct: s.fiveHourPct,
      remainingPct: s.fiveHourPct == null ? null : Math.max(0, 100 - s.fiveHourPct),
      resetsAt: s.fiveHourResetsAt,
    },
    sevenDay: {
      usedPct: s.sevenDayPct,
      remainingPct: s.sevenDayPct == null ? null : Math.max(0, 100 - s.sevenDayPct),
      resetsAt: s.sevenDayResetsAt,
    },
    tokensPerPercent: tokensPerPercent(state, (a, b) => tokensInRange(a, b)),
    samples: state.samples.length,
  };
}

/**
 * Pull the `## Context pack` section out of a ledger. Exported on its own so
 * the debug harness measures the pack exactly the way this script does.
 */
function parsePack(text) {
  const m = /^##\s+Context pack\s*$/m.exec(text || '');
  if (!m) return { present: false, lines: 0, bytes: 0 };
  const rest = text.slice(m.index + m[0].length);
  const end = /^##\s+/m.exec(rest);
  const body = (end ? rest.slice(0, end.index) : rest).trim();
  return {
    present: true,
    lines: body ? body.split('\n').length : 0,
    bytes: Buffer.byteLength(body, 'utf8'),
  };
}

/**
 * Pull the `## Cost forecast` out of a ledger and read the headline number.
 * Accepts the shapes a planner actually writes — "4.2M tokens", "850k tokens",
 * "1,200,000 tokens" — and returns null rather than guessing at anything else.
 */
function parseForecast(text) {
  const m = /^##\s+Cost forecast\s*$/m.exec(text || '');
  if (!m) return { present: false, tokens: null };
  const rest = text.slice(m.index + m[0].length);
  const end = /^##\s+/m.exec(rest);
  const body = (end ? rest.slice(0, end.index) : rest).trim();
  const num = /([\d,.]+)\s*([MmKk])?\s*tokens/.exec(body);
  let tokens = null;
  if (num) {
    const value = parseFloat(num[1].replace(/,/g, ''));
    if (!Number.isNaN(value)) {
      const scale = num[2] ? { m: 1e6, k: 1e3 }[num[2].toLowerCase()] : 1;
      tokens = Math.round(value * scale);
    }
  }
  return { present: true, tokens, lines: body ? body.split('\n').length : 0 };
}

/**
 * Pull the `## Plan cost` out of a ledger. Mirrors parseForecast — same number
 * shapes, different heading. The section deliberately sits *after* the forecast
 * in the template, because parseForecast takes the first number in its own
 * section and would happily read a plan-cost figure placed above the estimate.
 */
function parsePlanCost(text) {
  const m = /^##\s+Plan cost\s*$/m.exec(text || '');
  if (!m) return { present: false, tokens: null };
  const rest = text.slice(m.index + m[0].length);
  const end = /^##\s+/m.exec(rest);
  const body = (end ? rest.slice(0, end.index) : rest).trim();
  const num = /([\d,.]+)\s*([MmKk])?\s*tokens/.exec(body);
  let tokens = null;
  if (num) {
    const value = parseFloat(num[1].replace(/,/g, ''));
    if (!Number.isNaN(value)) {
      const scale = num[2] ? { m: 1e6, k: 1e3 }[num[2].toLowerCase()] : 1;
      tokens = Math.round(value * scale);
    }
  }
  return { present: true, tokens, lines: body ? body.split('\n').length : 0 };
}

/** The most recently modified ledger under docs/tasks/, or null. */
function newestLedger(projectDir) {
  const dir = path.join(projectDir || process.cwd(), 'docs', 'tasks');
  if (!fs.existsSync(dir)) return null;
  let newest = null;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.md')) continue;
    const abs = path.join(dir, f);
    let st;
    try { st = fs.statSync(abs); } catch { continue; }
    if (!newest || st.mtimeMs > newest.mtimeMs) newest = { abs, f, mtimeMs: st.mtimeMs };
  }
  return newest;
}

// --- plan cost ---------------------------------------------------------------

const blocksOf = (o) => (o.message && Array.isArray(o.message.content) ? o.message.content : []);
const totalOf = (t) => t.input + t.output + t.cacheRead + t.cacheWrite;

/**
 * The user's own words, or null for everything that merely looks like them.
 * Tool results, hook injections, slash-command carriers and compaction summaries
 * all arrive as `type: "user"` lines; none of them opened an order.
 */
function userPromptText(o) {
  if (o.type !== 'user' || o.isSidechain || o.isMeta || o.isCompactSummary) return null;
  const m = o.message;
  if (!m) return null;
  let text = null;
  if (typeof m.content === 'string') text = m.content;
  else if (Array.isArray(m.content)) {
    if (m.content.some((b) => b && b.type === 'tool_result')) return null;
    text = m.content.filter((b) => b && b.type === 'text').map((b) => b.text || '').join('\n');
  }
  const trimmed = (text || '').trim();
  if (!trimmed) return null;
  if (/^<(command-|local-command-|system-reminder)/.test(trimmed)) return null;
  return trimmed;
}

/** The last `Agent`/`Task` dispatch of task-planner — the last order wins. */
function findPlannerDispatch(lines) {
  let found = null;
  for (let i = 0; i < lines.length; i++) {
    const o = lines[i];
    if (o.type !== 'assistant') continue;
    for (const b of blocksOf(o)) {
      if (!b || b.type !== 'tool_use') continue;
      if (b.name !== 'Agent' && b.name !== 'Task') continue;
      const sub = b.input && b.input.subagent_type;
      if (sub !== 'task-planner') continue;
      found = { index: i, at: o.timestamp || null, id: b.id || null };
    }
  }
  return found;
}

/** The result line for a dispatch: by tool_use_id, falling back to agentType. */
function findPlannerResult(lines, fromIndex, toolUseId) {
  for (let i = fromIndex + 1; i < lines.length; i++) {
    const o = lines[i];
    if (!o.toolUseResult) continue;
    if (toolUseId && blocksOf(o).some((b) => b && b.type === 'tool_result' && b.tool_use_id === toolUseId)) {
      return { index: i, at: o.timestamp || null, result: o.toolUseResult };
    }
  }
  for (let i = fromIndex + 1; i < lines.length; i++) {
    const o = lines[i];
    if (o.toolUseResult && o.toolUseResult.agentType === 'task-planner') {
      return { index: i, at: o.timestamp || null, result: o.toolUseResult };
    }
  }
  return null;
}

/**
 * Sum a time window, main and subagent turns kept apart. Dedupe happens before
 * the window filter, so a turn belongs to the moment it started — the same rule
 * analyze() follows.
 */
function sumWindow(lines, fromMs, toMs) {
  const seen = new Set();
  const main = emptyTotals();
  const sidechain = emptyTotals();
  for (const o of lines) {
    const m = o.message;
    if (!m || !m.usage || o.type !== 'assistant' || m.model === '<synthetic>') continue;
    const key = o.requestId || `uuid:${o.uuid}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const t = o.timestamp ? Date.parse(o.timestamp) : NaN;
    if (!(t >= fromMs && t <= toMs)) continue;
    addUsage(o.isSidechain ? sidechain : main, m.usage);
  }
  return { main, sidechain };
}

/**
 * Last resort for the planner's own cost: a background dispatch returns
 * `{isAsync: true}` with no totals and writes nothing to the main transcript,
 * so the tokens only exist in the subagent's own file.
 */
function subagentTokens(sessionFile, agentId) {
  // Live sessions nest them under the transcript's own name; the debug tool
  // archives them beside it. Try both rather than care which we were given.
  const candidates = [
    path.join(path.dirname(sessionFile), path.basename(sessionFile, '.jsonl'), 'subagents'),
    path.join(path.dirname(sessionFile), 'subagents'),
  ];
  let dir = null;
  for (const c of candidates) {
    try { if (fs.statSync(c).isDirectory()) { dir = c; break; } } catch { /* try the next */ }
  }
  if (!dir) return null;
  let files;
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')); } catch { return null; }
  if (agentId) {
    const named = files.filter((f) => f.includes(agentId));
    if (named.length) files = named;
  } else if (files.length !== 1) {
    // Several subagents and nothing to tell them apart — better no number.
    return null;
  }
  const t = emptyTotals();
  const seen = new Set();
  for (const f of files) {
    let parsed;
    try { parsed = readJsonl(path.join(dir, f)); } catch { continue; }
    for (const o of parsed) {
      const m = o.message;
      if (!m || !m.usage || o.type !== 'assistant' || m.model === '<synthetic>') continue;
      const key = o.requestId || `uuid:${o.uuid}`;
      if (seen.has(key)) continue;
      seen.add(key);
      addUsage(t, m.usage);
    }
  }
  const total = totalOf(t);
  return total > 0 ? { tokens: total, source: 'subagent-transcript' } : null;
}

/**
 * What creating the current plan cost: every turn from the order's opening
 * prompt to the gate, with the task-planner dispatch broken out.
 *
 * This is a *breakdown* of the session total, not an addition to it — the same
 * turns are already inside what `--line` reports at step 7.
 *
 * Run from the main session only. A subagent cannot see its own transcript,
 * which is why the planner does not write this number itself.
 */
function slicePlanCost(lines, opts) {
  const o = opts || {};
  const dispatch = findPlannerDispatch(lines);
  if (!dispatch) return slicePlanCostSolo(lines, o);
  const result = findPlannerResult(lines, dispatch.index, dispatch.id);

  // Order start: the last thing the user actually typed before planning began.
  let orderStartAt = null;
  let orderStartSource = 'user-prompt';
  for (let i = dispatch.index; i >= 0; i--) {
    if (userPromptText(lines[i]) && lines[i].timestamp) { orderStartAt = lines[i].timestamp; break; }
  }
  if (!orderStartAt) {
    orderStartSource = 'session-start';
    for (const l of lines) {
      if (l.timestamp && (!orderStartAt || l.timestamp < orderStartAt)) orderStartAt = l.timestamp;
    }
  }

  // Window end: the gate if it has happened, otherwise "so far".
  let gateAt = null;
  let windowEndSource = 'transcript-end';
  for (let i = dispatch.index + 1; i < lines.length; i++) {
    const l = lines[i];
    if (l.type !== 'assistant') continue;
    if (blocksOf(l).some((b) => b && b.type === 'tool_use' && b.name === 'ExitPlanMode')) {
      gateAt = l.timestamp || null;
      if (gateAt) windowEndSource = 'exit-plan-mode';
      break;
    }
  }
  let windowEndAt = gateAt;
  if (!windowEndAt) {
    for (const l of lines) {
      if (l.timestamp && (!windowEndAt || l.timestamp > windowEndAt)) windowEndAt = l.timestamp;
    }
  }

  const fromMs = orderStartAt ? Date.parse(orderStartAt) : -Infinity;
  const toMs = windowEndAt ? Date.parse(windowEndAt) : Infinity;
  const win = sumWindow(lines, fromMs, toMs);

  // Attribution, best evidence first. `source` always says which one won, so a
  // number derived from a weaker method is never mistaken for a measured one.
  let planner = { tokens: null, source: null };
  const r = result && result.result;
  if (r && r.agentType === 'task-planner' && typeof r.totalTokens === 'number' && r.totalTokens > 0) {
    planner = { tokens: r.totalTokens, source: 'tool-result' };
  }
  if (planner.tokens == null) {
    const sc = totalOf(win.sidechain);
    if (sc > 0) planner = { tokens: sc, source: 'sidechain-window' };
  }
  if (planner.tokens == null && o.sessionFile) {
    const sub = subagentTokens(o.sessionFile, r && r.agentId);
    if (sub) planner = sub;
  }

  const mainTokens = totalOf(win.main);
  return {
    present: true,
    mode: 'team',
    orderStartAt,
    orderStartSource,
    plannerStartAt: dispatch.at,
    plannerEndAt: result ? result.at : null,
    gateAt,
    windowEndAt,
    windowEndSource,
    complete: windowEndSource === 'exit-plan-mode',
    main: win.main,
    mainTokens,
    planner,
    subagentTokens: 0,
    totalTokens: mainTokens + (planner.tokens || 0),
  };
}

/**
 * A solo order plans without dispatching anyone, so there is no dispatch to
 * anchor the window on. Two ways in:
 *
 *   - `opts.solo` — the caller says so. This is the gate case: the plan has not
 *     been presented yet, so the transcript holds no evidence either way and
 *     only the main session knows.
 *   - a gate exists and no planner was ever dispatched — unambiguous after the
 *     fact, which is what lets `--line` at step 7 emit the plan fragment for
 *     solo orders without anyone passing a flag.
 *
 * Absent both, this stays `present: false`: a session that simply never planned
 * anything must not be reported as one that planned cheaply.
 */
function slicePlanCostSolo(lines, o) {
  let gateIndex = -1;
  let gateAt = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i];
    if (l.type !== 'assistant') continue;
    if (blocksOf(l).some((b) => b && b.type === 'tool_use' && b.name === 'ExitPlanMode')) {
      gateIndex = i;
      gateAt = l.timestamp || null;
      break;
    }
  }
  if (gateIndex < 0 && !o.solo) {
    return { present: false, reason: 'no task-planner dispatch in this session' };
  }

  const anchor = gateIndex >= 0 ? gateIndex : lines.length - 1;
  let orderStartAt = null;
  let orderStartSource = 'user-prompt';
  for (let i = anchor; i >= 0; i--) {
    if (userPromptText(lines[i]) && lines[i].timestamp) { orderStartAt = lines[i].timestamp; break; }
  }
  if (!orderStartAt) {
    orderStartSource = 'session-start';
    for (const l of lines) {
      if (l.timestamp && (!orderStartAt || l.timestamp < orderStartAt)) orderStartAt = l.timestamp;
    }
  }

  let windowEndAt = gateAt;
  const windowEndSource = gateAt ? 'exit-plan-mode' : 'transcript-end';
  if (!windowEndAt) {
    for (const l of lines) {
      if (l.timestamp && (!windowEndAt || l.timestamp > windowEndAt)) windowEndAt = l.timestamp;
    }
  }

  const win = sumWindow(lines,
    orderStartAt ? Date.parse(orderStartAt) : -Infinity,
    windowEndAt ? Date.parse(windowEndAt) : Infinity);
  const mainTokens = totalOf(win.main);
  // Any subagent the main session ran while planning (a search, say) is part of
  // what planning cost, but it is not the planner. Counted, named separately.
  const subTokens = totalOf(win.sidechain);

  return {
    present: true,
    mode: 'solo',
    orderStartAt,
    orderStartSource,
    plannerStartAt: null,
    plannerEndAt: null,
    gateAt,
    windowEndAt,
    windowEndSource,
    complete: windowEndSource === 'exit-plan-mode',
    main: win.main,
    mainTokens,
    planner: { tokens: null, source: 'not-dispatched' },
    subagentTokens: subTokens,
    totalTokens: mainTokens + subTokens,
  };
}

/** Context-pack stats for the most recently modified ledger. */
function packStats(projectDir) {
  const dir = path.join(projectDir, 'docs', 'tasks');
  if (!fs.existsSync(dir)) return { present: false, reason: 'no docs/tasks/' };
  const newest = newestLedger(projectDir);
  if (!newest) return { present: false, reason: 'no ledger' };
  const pack = parsePack(fs.readFileSync(newest.abs, 'utf8'));
  if (!pack.present) return { present: false, ledger: newest.f, reason: 'ledger has no context pack' };
  return { ...pack, ledger: newest.f };
}

// --- formatting -------------------------------------------------------------

const compact = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n));
const pct = (v) => (v === null ? 'n/a' : `${Math.round(v * 100)}%`);
const usd = (v) => (v === null ? 'n/a' : `$${v < 1 ? v.toFixed(2) : v.toFixed(2)}`);

function formatLine(rep, pack, plan) {
  const bits = [
    `${compact(rep.totalTokens)} tokens`,
    `~${usd(rep.estimatedCostUsd)}`,
    `cache ${pct(rep.hitRate)}`,
  ];
  const d = rep.agents.reduce((s, a) => s + a.dispatches, 0);
  if (d) bits.push(`${d} dispatch${d === 1 ? '' : 'es'}`);
  if (pack && pack.present) bits.push(`pack ${pack.lines}L`);
  else bits.push('no pack');
  // A fragment of the total above, not an addition to it — see cost-forecast.md.
  if (plan && plan.present) bits.push(`plan ${compact(plan.totalTokens)}`);
  if (rep.invalidations.length) bits.push(`${rep.invalidations.length} cache break${rep.invalidations.length === 1 ? '' : 's'}`);
  return bits.join(' · ');
}

const PLANNER_SOURCE_NOTE = {
  'tool-result': 'from the dispatch result',
  'sidechain-window': 'summed from subagent turns in the window',
  'subagent-transcript': 'from the subagent transcript',
};

function formatPlanCost(pc, forecastTokens) {
  const L = [];
  L.push('Plan cost — what creating this plan has cost');
  if (!pc.present) {
    L.push(`  unknown: ${pc.reason}`);
    L.push('  Only measurable in a session that ran the operate loop — step 2 dispatches task-planner,');
    L.push('  or pass --solo if this session planned a solo order itself.');
    return L.join('\n');
  }
  const row = (label, n, note) => `  ${label.padEnd(30)}${compact(n).padStart(8)} tokens${note ? `   (${note})` : ''}`;
  L.push(row('main session (analyze + gate)', pc.mainTokens));
  if (pc.planner.source === 'not-dispatched') {
    L.push(`  ${'task-planner'.padEnd(30)}${'—'.padStart(8)}          (not dispatched — solo order, the main session planned)`);
    if (pc.subagentTokens) L.push(row('other subagents', pc.subagentTokens, 'ran during planning'));
  } else if (pc.planner.tokens == null) {
    L.push(`  ${'task-planner'.padEnd(30)}${'unknown'.padStart(8)}          (async dispatch, no subagent transcript found)`);
  } else {
    L.push(row('task-planner', pc.planner.tokens, PLANNER_SOURCE_NOTE[pc.planner.source]));
  }
  const share = forecastTokens ? `   — ${Math.round((pc.totalTokens / forecastTokens) * 100)}% of the ${compact(forecastTokens)} order forecast` : '';
  L.push(`  ${'planning total'.padEnd(30)}${compact(pc.totalTokens).padStart(8)} tokens${share}`);
  L.push('');
  if (!pc.complete) L.push('  Measured so far — the gate turn itself is not counted yet.');
  if (pc.orderStartSource === 'session-start') {
    L.push('  Measured from session start — no user prompt was found before the dispatch.');
  }
  L.push('  A breakdown of the session total, not an addition to it.');
  return L.join('\n');
}

function relTime(ms) {
  const m = Math.round(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
}

function clockOf(epochSeconds) {
  if (!epochSeconds) return null;
  const d = new Date(epochSeconds * 1000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatBudget(b) {
  const L = [];
  L.push('Budget — subscription usage windows');
  if (!b.available) {
    L.push(`  unknown: ${b.reason}`);
    L.push('  Run /usage for the authoritative figures.');
    return L.join('\n');
  }
  const line = (label, w) => {
    if (w.usedPct == null) return `  ${label.padEnd(9)} unknown`;
    // Derive "left" from the rounded "used" so the two always sum to 100.
    const used = Math.round(w.usedPct);
    const at = clockOf(w.resetsAt);
    return `  ${label.padEnd(9)} ${String(used).padStart(3)}% used`
      + `   ${String(100 - used).padStart(3)}% left`
      + (at ? `   resets ${at}` : '');
  };
  L.push(line('5-hour', b.fiveHour));
  L.push(line('7-day', b.sevenDay));
  L.push('');
  L.push(`  reading is ${relTime(b.ageMs)}${b.stale ? ' — stale; the status line updates it on the next render' : ''}`);
  if (b.tokensPerPercent) {
    L.push(`  ≈ ${compact(Math.round(b.tokensPerPercent))} tokens per 1% of the 5-hour window (median of ${b.samples} samples on this machine)`);
  } else {
    L.push('  tokens-per-percent not derivable yet — needs two samples spanning a change in the window');
  }
  L.push('  Machine-local and only as fresh as the last status-line render. /usage is the authority.');
  return L.join('\n');
}

function formatReport(rep, pack, file) {
  const L = [];
  L.push(`Token report — ${path.basename(file)}`);
  L.push(`  models: ${rep.models.join(', ') || 'unknown'}   ttl: ${rep.ttl}`);
  L.push('');
  L.push(`  total       ${compact(rep.totalTokens).padStart(8)}   est. ${usd(rep.estimatedCostUsd)}`);
  L.push(`  cache hit   ${pct(rep.hitRate).padStart(8)}   (main ${pct(rep.mainHitRate)}, subagents ${pct(rep.subHitRate)})`);
  L.push('');
  L.push('               input    output     read     write');
  const row = (label, t) => `  ${label.padEnd(10)}${compact(t.input).padStart(7)}${compact(t.output).padStart(10)}${compact(t.cacheRead).padStart(9)}${compact(t.cacheWrite).padStart(10)}`;
  L.push(row('main', rep.main));
  L.push(row('subagents', rep.sub));

  if (rep.agents.length) {
    L.push('');
    L.push('  by agent type');
    for (const a of rep.agents) {
      L.push(`    ${a.type.padEnd(24)} ${String(a.dispatches).padStart(3)} dispatch(es)  ${compact(a.tokens).padStart(8)} tokens`);
    }
  }

  L.push('');
  if (pack.present) L.push(`  context pack: ${pack.lines} lines / ${pack.bytes} bytes  (${pack.ledger})`);
  else L.push(`  context pack: none — ${pack.reason}`);

  L.push('');
  const iv = rep.invalidations;
  if (!iv.length) {
    L.push('  no cache breaks detected — the prefix held for the whole session.');
  } else {
    const explained = iv.filter((x) => x.cause).length;
    L.push(`  ${iv.length} cache break(s) — the prefix was rebuilt from scratch:`);
    for (const x of iv.slice(0, 10)) {
      const when = x.at ? x.at.replace('T', ' ').replace(/\..*$/, '') : `request #${x.index}`;
      L.push(`    ${when}  rebuilt ${compact(x.cacheWrite).padStart(7)}  (read ${compact(x.priorRead)} → ${compact(x.cacheRead)})`);
      if (x.cause) L.push(`        cause: ${x.cause}`);
    }
    if (iv.length > 10) L.push(`    … and ${iv.length - 10} more`);
    if (explained < iv.length) {
      L.push('');
      L.push('  Unattributed breaks are usually /compact, an /effort change, an MCP server');
      L.push('  connecting or dropping, fast mode being switched on, or a Claude Code upgrade');
      L.push('  mid-session. See .claude/conventions/cache-discipline.md.');
    }
  }
  return L.join('\n');
}

// --- cli --------------------------------------------------------------------

function main() {
  const argv = process.argv.slice(2);
  const wantLine = argv.includes('--line');
  const wantJson = argv.includes('--json');
  const wantBudget = argv.includes('--budget');
  const wantPlanCost = argv.includes('--plan-cost');
  const solo = argv.includes('--solo');
  const projectDir = process.cwd();

  // --budget answers "can I afford to start this?" and needs no transcript.
  if (wantBudget) {
    const b = budgetReport(projectDir);
    console.log(wantJson ? JSON.stringify(b, null, 2) : formatBudget(b));
    return;
  }

  let file = argv.find((a) => !a.startsWith('--'));

  if (!file) file = findSessionFor(projectDir);
  if (!file || !fs.existsSync(file)) {
    const msg = 'no session transcript found for this directory';
    if (wantLine) { console.log(`(${msg})`); return; }
    console.error(`token-report: ${msg}.\nPass one explicitly: node .claude/scripts/token-report.js <transcript.jsonl>`);
    process.exitCode = 1;
    return;
  }

  const lines = readJsonl(file);
  const planCost = slicePlanCost(lines, { sessionFile: file, solo });
  const ledger = newestLedger(projectDir);
  let forecastTokens = null;
  if (ledger) {
    try { forecastTokens = parseForecast(fs.readFileSync(ledger.abs, 'utf8')).tokens; } catch { /* no forecast */ }
  }

  // --plan-cost answers "what has planning already spent?" at the gate.
  if (wantPlanCost) {
    if (wantJson) console.log(JSON.stringify({ file, planCost, forecastTokens }, null, 2));
    else console.log(formatPlanCost(planCost, forecastTokens));
    return;
  }

  const rep = analyze(lines);
  const pack = packStats(projectDir);
  const budget = budgetReport(projectDir);

  if (wantJson) console.log(JSON.stringify({ file, ...rep, pack, budget, planCost }, null, 2));
  else if (wantLine) console.log(formatLine(rep, pack, planCost));
  else console.log(`${formatReport(rep, pack, file)}\n\n${formatPlanCost(planCost, forecastTokens)}\n\n${formatBudget(budget)}`);
}

module.exports = {
  readJsonl, findSessionFor, analyze, packStats, parsePack, parseForecast, hitRate, costOf,
  parsePlanCost, slicePlanCost, formatPlanCost, newestLedger,
  formatLine, formatReport,
  readBudgetState, budgetReport, tokensPerPercent, tokensInRange, formatBudget,
  PRICING, CACHE_READ_MULT, CACHE_WRITE_MULT, SPIKE_MIN_WRITE, SPIKE_READ_RATIO,
};

if (require.main === module) main();
