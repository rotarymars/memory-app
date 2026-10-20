// Pure state transitions for a review session: answering, relearning a missed
// card a few cards later, and merging answers into the unsaved-results map.
// The UI keeps the previous state around so the last answer can be undone.

import { requeueCard } from "./review-order";
import { nextLevel, type ReviewOutcome } from "./spaced-repetition";

export type OutcomeCounts = Record<ReviewOutcome, number>;

export const NO_COUNTS: OutcomeCounts = { again: 0, down: 0, good: 0, great: 0 };

// An unsaved result for one card: the level it's moving to, the level it was
// at when these answers started (`from`), and how many of each answer were
// given since.
export type PendingReview = { level: number; from: number; counts: OutcomeCounts };

// One answer, not yet merged into the pending map. The session holds the most
// recent answer back like this so it can still be undone.
export type HeldAnswer = {
  id: number;
  outcome: ReviewOutcome;
  from: number;
  level: number;
};

export type SessionCard = {
  id: number;
  reviewLevel: number;
  // Set on a copy put back into the queue after a miss.
  relearn?: boolean;
};

export type SessionState<T extends SessionCard> = {
  queue: T[];
  index: number;
  completed: number;
  // Ids of cards missed at least once this session, in the order first missed.
  missed: number[];
};

export function startSession<T extends SessionCard>(
  cards: T[]
): SessionState<T> {
  return { queue: cards, index: 0, completed: 0, missed: [] };
}

function addMissed(missed: number[], id: number): number[] {
  return missed.includes(id) ? missed : [...missed, id];
}

// Grades the card on screen. Every answer moves the card on the ladder,
// re-shows included, so a card missed and then recalled ends up one level
// below where it started (L5 → Again → L3 → Good → L4). A miss puts the card
// back a few cards later at its lowered level, until it's answered correctly.
export function answerCard<T extends SessionCard>(
  state: SessionState<T>,
  outcome: ReviewOutcome
): { state: SessionState<T>; held: HeldAnswer } | null {
  const current = state.queue[state.index];
  if (!current) return null;
  const level = nextLevel(current.reviewLevel, outcome);
  const held: HeldAnswer = {
    id: current.id,
    outcome,
    from: current.reviewLevel,
    level,
  };
  const again = outcome === "again";
  return {
    held,
    state: {
      queue: again
        ? requeueCard(state.queue, state.index + 1, {
            ...current,
            reviewLevel: level,
          })
        : state.queue,
      index: state.index + 1,
      completed: state.completed + 1,
      missed: again ? addMissed(state.missed, current.id) : state.missed,
    },
  };
}

// Practice: a miss puts the card back a few cards later, a hit drops it.
// Levels never change.
export function practiceCard<T extends SessionCard>(
  state: SessionState<T>,
  gotIt: boolean
): SessionState<T> | null {
  const current = state.queue[state.index];
  if (!current) return null;
  return {
    queue: gotIt
      ? state.queue
      : requeueCard(state.queue, state.index + 1, current),
    index: state.index + 1,
    completed: state.completed + 1,
    missed: gotIt ? state.missed : addMissed(state.missed, current.id),
  };
}

// Folds an answer into the card's pending entry. Answering the same card again
// before a save keeps `from` and adds up the counts.
export function mergeAnswer(
  prev: PendingReview | undefined,
  answer: HeldAnswer
): PendingReview {
  const counts = { ...(prev?.counts ?? NO_COUNTS) };
  counts[answer.outcome] += 1;
  return {
    level: answer.level,
    from: prev?.from ?? answer.from,
    counts,
  };
}
