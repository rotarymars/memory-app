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

// How far back a missed card goes: it's shown again as the RELEARN_GAP-th card
// after the one you just answered (so RELEARN_GAP - 1 others come between).
export const RELEARN_GAP = 5;

// Where a missed card re-enters the queue, given that the cards still to come
// start at `start`. Clamped to the end when fewer cards are left.
export function relearnIndex(
  queueLength: number,
  start: number,
  gap: number = RELEARN_GAP
): number {
  return Math.min(start + Math.max(0, gap - 1), queueLength);
}

// Puts a missed card back into the part of the queue still to come (from
// `start` on), RELEARN_GAP cards later. This ignores the card order on purpose:
// a miss lowers the card's level, so slotting it by level in "lowest level
// first" would bring it straight back. The copy is flagged `relearn` so a later
// order change leaves it where it is.
export function requeueCard<
  T extends { reviewLevel: number; relearn?: boolean },
>(queue: T[], start: number, card: T, gap: number = RELEARN_GAP): T[] {
  const at = relearnIndex(queue.length, start, gap);
  return [...queue.slice(0, at), { ...card, relearn: true }, ...queue.slice(at)];
}

// Re-sorts the cards from `from` on. Cards waiting to be relearned keep their
// slot so a new order can't pull a just-missed card to the front; everything
// else is reordered into the remaining slots.
export function reorderRemaining<
  T extends { reviewLevel: number; relearn?: boolean },
>(queue: T[], from: number, order: ReviewOrder): T[] {
  const rest = queue.slice(from);
  const sorted = orderCards(
    rest.filter((c) => !c.relearn),
    order
  );
  let k = 0;
  return [
    ...queue.slice(0, from),
    ...rest.map((c) => (c.relearn ? c : sorted[k++])),
  ];
}
