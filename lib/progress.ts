// Turns the grouped rows from `progressRows` into per-tag progress: how well
// you recall each tag, how far along its cards are, and how long until every
// card in it is mature. Pure computation — no database access.

import type { OutcomeCounts, ProgressRow } from "./cards";
import {
  intervalMinutesForLevel,
  MATURE_LEVEL,
  nextLevel,
  REVIEW_OUTCOMES,
  type ReviewOutcome,
} from "./spaced-repetition";

type OutcomeProbabilities = Record<ReviewOutcome, number>;

// Pseudo-reviews that stand in for history you don't have yet (80% recall).
// They keep the estimate sane for new tags and fade out as real answers pile
// up.
const PRIOR_COUNTS: OutcomeCounts = { again: 1, down: 1, good: 6, great: 2 };
// How many reviews a tag needs before its own record outweighs your overall
// record.
const TAG_PRIOR_WEIGHT = 10;

// Levels below this are still on the same-day part of the ladder (< 1 day).
const LEARNING_BELOW_LEVEL = 7;

export type TagProgress = {
  tag: string | null;
  total: number;
  learning: number; // on the intra-day part of the ladder
  young: number; // scheduled days out, not yet mature
  mature: number;
  counts: OutcomeCounts;
  reviews: number;
  // Share of answers that were Good or Easy; null with no answers recorded.
  recallRate: number | null;
  // Expected time until every card in the tag is mature (0 if they all are).
  msToMature: number;
  // Expected number of reviews still needed to get there.
  reviewsToMature: number;
};

export type ProgressSummary = {
  tags: TagProgress[];
  overall: TagProgress;
};

export function summarizeProgress(
  rows: ProgressRow[],
  now: Date = new Date()
): ProgressSummary {
  const byTag = new Map<string | null, ProgressRow[]>();
  for (const row of rows) {
    const group = byTag.get(row.tag);
    if (group) group.push(row);
    else byTag.set(row.tag, [row]);
  }

  const overallCounts = sumCounts(rows.map((r) => r.counts));
  const overallProbs = probabilities(overallCounts, PRIOR_COUNTS);

  const tags = Array.from(byTag, ([tag, group]) => {
    const counts = sumCounts(group.map((r) => r.counts));
    const probs = probabilities(
      counts,
      scale(overallProbs, TAG_PRIOR_WEIGHT)
    );
    return tagProgress(tag, group, counts, probs, now);
  }).sort(compareTags);

  const overall = tagProgress(null, rows, overallCounts, overallProbs, now);
  // Each tag is estimated with its own recall; the overall finish line is
  // whichever tag gets there last.
  overall.msToMature = Math.max(0, ...tags.map((t) => t.msToMature));
  overall.reviewsToMature = tags.reduce((n, t) => n + t.reviewsToMature, 0);

  return { tags, overall };
}

function tagProgress(
  tag: string | null,
  rows: ProgressRow[],
  counts: OutcomeCounts,
  probs: OutcomeProbabilities,
  now: Date
): TagProgress {
  const { minutes, reviews } = expectedToMature(probs);
  const result: TagProgress = {
    tag,
    total: 0,
    learning: 0,
    young: 0,
    mature: 0,
    counts,
    reviews: totalOf(counts),
    recallRate: null,
    msToMature: 0,
    reviewsToMature: 0,
  };
  if (result.reviews > 0) {
    result.recallRate = (counts.good + counts.great) / result.reviews;
  }

  for (const row of rows) {
    result.total += row.cards;
    if (row.level >= MATURE_LEVEL) {
      result.mature += row.cards;
      continue;
    }
    if (row.level < LEARNING_BELOW_LEVEL) result.learning += row.cards;
    else result.young += row.cards;

    // Wait until the latest card in this group comes due, then climb the
    // rest of the ladder. `minutes[level]` includes waiting out the card's
    // current interval, which the due date already accounts for.
    const waitMs = Math.max(0, row.lastDueAt.getTime() - now.getTime());
    const climbMinutes = minutes[row.level] - intervalMinutesForLevel(row.level);
    result.msToMature = Math.max(
      result.msToMature,
      waitMs + climbMinutes * 60_000
    );
    result.reviewsToMature += row.cards * reviews[row.level];
  }
  result.reviewsToMature = Math.round(result.reviewsToMature);
  return result;
}

// Expected minutes and reviews for a card that was just scheduled at each
// level below MATURE_LEVEL to reach it, if you review it whenever it comes
// due and answer with the given odds. Each review is a step in a Markov chain
// over levels, so for every level k:
//
//   E[k] = cost(k) + Σ p(outcome) · E[next level after outcome]
//
// with E = 0 once mature. That's a small linear system (one equation per
// level), solved directly.
function expectedToMature(probs: OutcomeProbabilities): {
  minutes: number[];
  reviews: number[];
} {
  const n = MATURE_LEVEL;
  // Rows of (I - P); the right-hand sides are filled in per cost below.
  const matrix: number[][] = [];
  for (let k = 0; k < n; k++) {
    const row = new Array<number>(n).fill(0);
    row[k] += 1;
    for (const outcome of REVIEW_OUTCOMES) {
      const to = nextLevel(k, outcome);
      if (to < n) row[to] -= probs[outcome];
    }
    matrix.push(row);
  }
  const minutesCost = Array.from({ length: n }, (_, k) =>
    intervalMinutesForLevel(k)
  );
  const reviewsCost = new Array<number>(n).fill(1);
  return {
    minutes: solve(matrix, minutesCost),
    reviews: solve(matrix, reviewsCost),
  };
}

// Gaussian elimination with partial pivoting. The system is always solvable
// here: the prior keeps the odds of moving up above zero, so every level can
// reach maturity.
function solve(a: number[][], b: number[]): number[] {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    }
    [m[col], m[pivot]] = [m[pivot], m[col]];
    for (let r = col + 1; r < n; r++) {
      const f = m[r][col] / m[col][col];
      if (f === 0) continue;
      for (let c = col; c <= n; c++) m[r][c] -= f * m[col][c];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let sum = m[r][n];
    for (let c = r + 1; c < n; c++) sum -= m[r][c] * x[c];
    x[r] = sum / m[r][r];
  }
  return x;
}

function probabilities(
  counts: OutcomeCounts,
  prior: OutcomeCounts
): OutcomeProbabilities {
  const total = totalOf(counts) + totalOf(prior);
  const p = {} as OutcomeProbabilities;
  for (const o of REVIEW_OUTCOMES) p[o] = (counts[o] + prior[o]) / total;
  return p;
}

function scale(p: OutcomeProbabilities, weight: number): OutcomeCounts {
  const c = {} as OutcomeCounts;
  for (const o of REVIEW_OUTCOMES) c[o] = p[o] * weight;
  return c;
}

function sumCounts(list: OutcomeCounts[]): OutcomeCounts {
  const sum: OutcomeCounts = { again: 0, down: 0, good: 0, great: 0 };
  for (const c of list) for (const o of REVIEW_OUTCOMES) sum[o] += c[o];
  return sum;
}

function totalOf(c: OutcomeCounts): number {
  return c.again + c.down + c.good + c.great;
}

// Named tags alphabetically, untagged cards last.
function compareTags(a: TagProgress, b: TagProgress): number {
  if (a.tag === null) return b.tag === null ? 0 : 1;
  if (b.tag === null) return -1;
  return a.tag.localeCompare(b.tag);
}

export function formatDuration(ms: number): string {
  const hours = ms / 3_600_000;
  if (hours < 1) return "under an hour";
  if (hours < 36) return plural(Math.round(hours), "hour");
  const days = hours / 24;
  if (days < 14) return plural(Math.round(days), "day");
  if (days < 60) return plural(Math.round(days / 7), "week");
  if (days < 730) return plural(Math.round(days / 30), "month");
  return plural(Math.round(days / 365), "year");
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}
