// The order a review session goes through its cards. Cards on the same level
// are equally urgent, so within a level they're always shuffled rather than
// falling back to creation or due-date order.

export const REVIEW_ORDERS = ["random", "low", "high"] as const;
export type ReviewOrder = (typeof REVIEW_ORDERS)[number];

export const REVIEW_ORDER_LABELS: Record<ReviewOrder, string> = {
  random: "Random",
  low: "Lowest level first",
  high: "Highest level first",
};

export function parseReviewOrder(value: string | null | undefined): ReviewOrder {
  return REVIEW_ORDERS.includes(value as ReviewOrder)
    ? (value as ReviewOrder)
    : "random";
}

function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function orderCards<T extends { reviewLevel: number }>(
  cards: T[],
  order: ReviewOrder
): T[] {
  const out = shuffled(cards);
  // Array.prototype.sort is stable, so the shuffle survives within a level.
  if (order === "low") out.sort((a, b) => a.reviewLevel - b.reviewLevel);
  if (order === "high") out.sort((a, b) => b.reviewLevel - a.reviewLevel);
  return out;
}

// Puts a card back into the part of the queue still to come (from `start`
// on). In a level order it lands at the end of its level's group, so a missed
// low-level card comes back before anything higher; in random order it goes
// to the back.
export function requeueCard<T extends { reviewLevel: number }>(
  queue: T[],
  start: number,
  card: T,
  order: ReviewOrder
): T[] {
  let at = queue.length;
  if (order !== "random") {
    const comesAfter = (other: T) =>
      order === "low"
        ? other.reviewLevel > card.reviewLevel
        : other.reviewLevel < card.reviewLevel;
    const i = queue.findIndex((c, j) => j >= start && comesAfter(c));
    if (i !== -1) at = i;
  }
  return [...queue.slice(0, at), card, ...queue.slice(at)];
}
