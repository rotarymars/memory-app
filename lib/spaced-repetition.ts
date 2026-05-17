// Ebbinghaus-style review intervals (in days).
// Each successful recall advances the card to the next level.
// A failed recall resets the level to 0 (review again tomorrow).
export const REVIEW_INTERVALS_DAYS = [
  1, // level 0 -> review in 1 day
  2, // level 1 -> review in 2 days
  4, // level 2 -> review in 4 days
  7, // level 3 -> review in 1 week
  15, // level 4 -> review in ~2 weeks
  30, // level 5 -> review in 1 month
  60, // level 6 -> review in 2 months
  120, // level 7 -> review in 4 months
  240, // level 8+ -> review every 8 months (mastered)
] as const;

export const MAX_LEVEL = REVIEW_INTERVALS_DAYS.length - 1;

export function intervalDaysForLevel(level: number): number {
  const bounded = Math.max(0, Math.min(level, MAX_LEVEL));
  return REVIEW_INTERVALS_DAYS[bounded];
}

export function nextReviewDate(level: number, from: Date = new Date()): Date {
  const days = intervalDaysForLevel(level);
  const next = new Date(from);
  next.setDate(next.getDate() + days);
  return next;
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

export function formatInterval(days: number): string {
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.round(days / 7)}w`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${Math.round(days / 365)}y`;
}
