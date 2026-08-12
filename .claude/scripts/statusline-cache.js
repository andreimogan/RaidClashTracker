#!/usr/bin/env node
'use strict';
/**
 * statusline-cache — live cache health and budget in the status line.
 *
 * Reads Claude Code's statusline JSON on stdin and prints one line:
 *
 *   sonnet-5 · ctx 34% · cache 94% · 5h 23%
 *   sonnet-5 · ctx 34% · cache 71% ! rebuilding prefix · 5h 88% ⚠
 *
 * The cache `!` marker fires when cache writes are 10% or more of this
 * session's input — the same threshold Claude Code's own usage view uses to
 * flag cache misses. Seeing it appear right after an action tells you that
 * action broke the prefix; `/token-report` then says which one.
 *
 * It also acts as the **budget sensor**. Claude Code hands the statusline the
 * authoritative rate-limit figures, and this is the only place they are
 * observable programmatically — so every render appends the reading to
 * `.claude/budget-state.json`, where `token-report.js --budget` can find it
 * later. Nothing else in the scaffold can see those numbers.
 *
 * Wired by /bootstrap into .claude/settings.json as the `statusLine` command.
 * Zero dependencies. Must never throw: a status line that errors is worse than
 * no status line, so every failure path prints something harmless and the
 * persistence side is entirely best-effort.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const WARN_WRITE_SHARE = 0.10;
const BUDGET_WARN_PCT = 80;

// Keep the file small and bounded: enough samples to derive a tokens-per-percent
// figure across a window, not a permanent history.
const MAX_SAMPLES = 200;
const MAX_AGE_MS = 8 * 24 * 60 * 60 * 1000;
// Two renders a second apart say nothing new; throttle to keep the file useful.
const MIN_SAMPLE_GAP_MS = 60 * 1000;

const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';

/** Where samples live. Overridable so tests never touch a real project. */
function stateFile(d) {
  if (process.env.ATS_BUDGET_STATE) return process.env.ATS_BUDGET_STATE;
  const root = (d && d.workspace && (d.workspace.project_dir || d.workspace.current_dir))
    || process.cwd();
  return path.join(root, '.claude', 'budget-state.json');
}

/**
 * Append this reading to the state file. Best-effort by definition: a status
 * line that fails to write a cache file must still render.
 */
function persist(d) {
  const rl = d && d.rate_limits;
  if (!rl || !rl.five_hour) return;
  const file = stateFile(d);
  try {
    if (!fs.existsSync(path.dirname(file))) return;   // not a scaffolded project
    let state = { samples: [] };
    try {
      const prior = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (prior && Array.isArray(prior.samples)) state = prior;
    } catch { /* corrupt or absent — start over rather than fail */ }

    const now = Date.now();
    const last = state.samples[state.samples.length - 1];
    if (last && now - last.at < MIN_SAMPLE_GAP_MS
        && last.fiveHourPct === (rl.five_hour.used_percentage ?? null)) {
      return;   // nothing changed and barely any time passed
    }

    state.samples.push({
      at: now,
      sessionId: (d && d.session_id) || null,
      fiveHourPct: rl.five_hour.used_percentage ?? null,
      fiveHourResetsAt: rl.five_hour.resets_at ?? null,
      sevenDayPct: rl.seven_day ? (rl.seven_day.used_percentage ?? null) : null,
      sevenDayResetsAt: rl.seven_day ? (rl.seven_day.resets_at ?? null) : null,
    });
    state.samples = state.samples
      .filter((s) => now - s.at <= MAX_AGE_MS)
      .slice(-MAX_SAMPLES);
    state.updatedAt = now;

    // Write via tmp+rename so a reader never sees a half-written file.
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state), 'utf8');
    fs.renameSync(tmp, file);
  } catch { /* never let persistence break the status line */ }
}

function clock(epochSeconds) {
  try {
    const dt = new Date(epochSeconds * 1000);
    return `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
  } catch { return null; }
}

function render(d) {
  const bits = [];

  const model = (d.model && (d.model.display_name || d.model.id)) || null;
  if (model) bits.push(String(model).replace(/^claude-/, ''));

  const cw = d.context_window || {};
  if (typeof cw.used_percentage === 'number') {
    bits.push(`ctx ${Math.round(cw.used_percentage)}%`);
  }

  const u = cw.current_usage;
  if (u) {
    const read = u.cache_read_input_tokens || 0;
    const write = u.cache_creation_input_tokens || 0;
    const input = u.input_tokens || 0;
    const denom = read + write + input;
    if (denom > 0) {
      const rate = read / denom;
      const hot = write / denom < WARN_WRITE_SHARE;
      bits.push(`${hot ? GREEN : YELLOW}cache ${Math.round(rate * 100)}%${RESET}`);
      if (!hot) bits.push(`${YELLOW}! rebuilding prefix${RESET}`);
    } else {
      bits.push(`${DIM}cache —${RESET}`);
    }
  } else {
    // null before the first API call of a session, and again after /compact
    // until the next call repopulates it. Not an error.
    bits.push(`${DIM}cache —${RESET}`);
  }

  // The five-hour window is the one that decides whether to start work now.
  const five = d.rate_limits && d.rate_limits.five_hour;
  if (five && typeof five.used_percentage === 'number') {
    const pct = Math.round(five.used_percentage);
    const hot = pct < BUDGET_WARN_PCT;
    const at = five.resets_at ? clock(five.resets_at) : null;
    bits.push(`${hot ? '' : YELLOW}5h ${pct}%${at && !hot ? ` · resets ${at}` : ''}${hot ? '' : RESET}`);
  }

  return bits.join(` ${DIM}·${RESET} `);
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { raw += c; });
process.stdin.on('end', () => {
  let data = null;
  try { data = JSON.parse(raw); } catch { process.stdout.write(''); return; }
  try { process.stdout.write(render(data)); } catch { process.stdout.write(''); }
  persist(data);
});
process.stdin.on('error', () => process.stdout.write(''));

module.exports = { render, persist, stateFile, WARN_WRITE_SHARE, BUDGET_WARN_PCT, MIN_SAMPLE_GAP_MS };
