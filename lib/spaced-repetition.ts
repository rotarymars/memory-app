// Ebbinghaus-style review intervals, in minutes.
// A review nudges the card along this ladder of levels: it can reset the card
// to level 0, step one level down, one level up, or two levels up.

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

export function clampLevel(level: number): number {
  return Math.max(0, Math.min(level, MAX_LEVEL));
}

export function intervalMinutesForLevel(level: number): number {
  return REVIEW_INTERVALS_MINUTES[clampLevel(level)];
}

export function nextReviewDate(level: number, from: Date = new Date()): Date {
  const minutes = intervalMinutesForLevel(level);
  return new Date(from.getTime() + minutes * 60_000);
}

// "again" resets to level 0; the others step relative to the current level.
export type ReviewOutcome = "again" | "down" | "good" | "great";

export function applyReview(
  currentLevel: number,
  outcome: ReviewOutcome,
  now: Date = new Date()
): { nextLevel: number; nextReviewAt: Date } {
  const target =
    outcome === "again"
      ? 0
      : outcome === "down"
        ? currentLevel - 1
        : outcome === "good"
          ? currentLevel + 1
          : currentLevel + 2; // "great": two levels up
  const nextLevel = clampLevel(target);
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

export function formatTimeUntil(
  target: Date,
  now: Date = new Date()
): string {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return "now";
  const minutes = Math.max(1, Math.round(ms / 60_000));
  return formatInterval(minutes);
}
