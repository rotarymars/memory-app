// Ebbinghaus-style review intervals, in minutes.
// Each successful recall advances the card to the next level.
// A failed recall resets the level to 0 (so the card resurfaces in 10 minutes).

const HOUR = 60;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;

export const REVIEW_INTERVALS_MINUTES = [
  10, //  0: 10 min
  30, //  1: 30 min
  HOUR, //  2: 1 h
  2 * HOUR, //  3: 2 h
  3 * HOUR, //  4: 3 h
  6 * HOUR, //  5: 6 h
  12 * HOUR, //  6: 12 h
  DAY, //  7: 1 d
  2 * DAY, //  8: 2 d
  3 * DAY, //  9: 3 d
  5 * DAY, // 10: 5 d
  10 * DAY, // 11: 10 d
  15 * DAY, // 12: 15 d
  MONTH, // 13: 1 mo
  2 * MONTH, // 14: 2 mo
  3 * MONTH, // 15: 3 mo
] as const;

export const MAX_LEVEL = REVIEW_INTERVALS_MINUTES.length - 1;

export function intervalMinutesForLevel(level: number): number {
  const bounded = Math.max(0, Math.min(level, MAX_LEVEL));
  return REVIEW_INTERVALS_MINUTES[bounded];
}

export function nextReviewDate(level: number, from: Date = new Date()): Date {
  const minutes = intervalMinutesForLevel(level);
  return new Date(from.getTime() + minutes * 60_000);
}

export type ReviewOutcome = "again" | "good";

export function applyReview(
  currentLevel: number,
  outcome: ReviewOutcome,
  now: Date = new Date()
): { nextLevel: number; nextReviewAt: Date } {
  const nextLevel =
    outcome === "good" ? Math.min(currentLevel + 1, MAX_LEVEL) : 0;
  return {
    nextLevel,
    nextReviewAt: nextReviewDate(nextLevel, now),
  };
}

export function formatInterval(minutes: number): string {
  if (minutes < HOUR) return `${minutes}min`;
  if (minutes < DAY) {
    const hours = minutes / HOUR;
    return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
  }
  if (minutes < MONTH) {
    const days = minutes / DAY;
    return `${Number.isInteger(days) ? days : days.toFixed(1)}d`;
  }
  const months = minutes / MONTH;
  return `${Number.isInteger(months) ? months : months.toFixed(1)}mo`;
}
