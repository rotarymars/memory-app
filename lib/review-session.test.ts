import { test } from "node:test";
import assert from "node:assert/strict";
import {
  orderCards,
  relearnIndex,
  reorderRemaining,
  requeueCard,
  RELEARN_GAP,
} from "./review-order";
import {
  answerCard,
  mergeAnswer,
  practiceCard,
  startSession,
  type SessionCard,
  type SessionState,
} from "./review-session";

function cards(...levels: number[]): SessionCard[] {
  return levels.map((reviewLevel, i) => ({ id: i + 1, reviewLevel }));
}

const ids = (q: SessionCard[]) => q.map((c) => c.id);

// Answers whatever is on screen with "good" until `id` comes up, returning how
// many other cards were shown in between.
function cardsUntil(
  state: SessionState<SessionCard>,
  id: number
): { between: number; state: SessionState<SessionCard> } {
  let between = 0;
  while (state.queue[state.index] && state.queue[state.index].id !== id) {
    state = answerCard(state, "good")!.state;
    between++;
  }
  return { between, state };
}

test("relearnIndex puts the card RELEARN_GAP cards later", () => {
  assert.equal(RELEARN_GAP, 5);
  // Current card at 0, the rest start at 1: comes back as the 5th card after.
  assert.equal(relearnIndex(20, 1), 5);
  assert.equal(relearnIndex(20, 7), 11);
});

test("relearnIndex clamps to the end when few cards remain", () => {
  assert.equal(relearnIndex(3, 1), 3);
  assert.equal(relearnIndex(1, 1), 1); // last card: straight back
  assert.equal(relearnIndex(6, 2), 6);
});

test("requeueCard inserts a flagged copy and leaves the rest in order", () => {
  const q = cards(0, 0, 0, 0, 0, 0, 0, 0);
  const out = requeueCard(q, 1, q[0]);
  assert.deepEqual(ids(out), [1, 2, 3, 4, 5, 1, 6, 7, 8]);
  assert.equal(out[5].relearn, true);
  assert.equal(q[0].relearn, undefined, "original is not mutated");
});

test("an Again card comes back 5 cards later, not at the end", () => {
  let s = startSession(cards(5, 5, 5, 5, 5, 5, 5, 5, 5, 5));
  s = answerCard(s, "again")!.state;
  const { between } = cardsUntil(s, 1);
  assert.equal(between, RELEARN_GAP - 1);
});

test("lowest-level-first: an Again card does not jump to the front", () => {
  // Sorted low → high. Card 1 is lowest; Again drops it to 0, below every
  // other card, but it must still wait its turn.
  const deck = orderCards(cards(2, 3, 3, 4, 4, 5, 6, 7, 8), "low");
  let s = startSession(deck);
  const first = s.queue[0].id;
  s = answerCard(s, "again")!.state;
  assert.notEqual(s.queue[s.index].id, first, "not shown immediately");
  const { between } = cardsUntil(s, first);
  assert.equal(between, RELEARN_GAP - 1);
});

test("changing the order keeps a relearning card in its slot", () => {
  const deck = orderCards(cards(3, 4, 5, 6, 7, 8, 9, 10), "high");
  let s = startSession(deck);
  const first = s.queue[0].id;
  s = answerCard(s, "again")!.state; // drops from 10 to 8
  const slot = s.queue.findIndex((c, i) => i >= s.index && c.id === first);
  const re = reorderRemaining(s.queue, s.index, "low");
  assert.equal(re[slot].id, first);
  assert.equal(re[slot].relearn, true);
  // Everything else is now lowest level first.
  const others = re.slice(s.index).filter((c) => !c.relearn);
  const levels = others.map((c) => c.reviewLevel);
  assert.deepEqual(levels, [...levels].sort((a, b) => a - b));
  assert.equal(re.length, s.queue.length);
});

test("Again near the end goes to the back; the last card comes right back", () => {
  let s = startSession(cards(5, 5, 5));
  s = answerCard(s, "good")!.state;
  s = answerCard(s, "again")!.state; // card 2, one card left after it
  assert.deepEqual(ids(s.queue.slice(s.index)), [3, 2]);
  s = answerCard(s, "good")!.state;
  s = answerCard(s, "again")!.state; // card 2 again, nothing else left
  assert.deepEqual(ids(s.queue.slice(s.index)), [2]);
});

test("a missed card keeps coming back until answered correctly", () => {
  let s = startSession(cards(5));
  s = answerCard(s, "again")!.state;
  s = answerCard(s, "again")!.state;
  assert.equal(s.queue.length - s.index, 1);
  s = answerCard(s, "down")!.state; // Hard counts as correct
  assert.equal(s.queue[s.index], undefined, "session over");
  assert.equal(s.completed, 3);
  assert.deepEqual(s.missed, [1]);
});

test("levels accumulate across re-shows (L5 → Again → L3 → Good → L4)", () => {
  let s = startSession(cards(5));
  const a = answerCard(s, "again")!;
  assert.deepEqual([a.held.from, a.held.level], [5, 3]);
  s = a.state;
  assert.equal(s.queue[s.index].reviewLevel, 3);
  const b = answerCard(s, "good")!;
  assert.deepEqual([b.held.from, b.held.level], [3, 4]);
});

test("mergeAnswer keeps the first `from` and counts every answer", () => {
  const p1 = mergeAnswer(undefined, { id: 1, outcome: "again", from: 5, level: 3 });
  const p2 = mergeAnswer(p1, { id: 1, outcome: "good", from: 3, level: 4 });
  assert.deepEqual(p2, {
    level: 4,
    from: 5,
    counts: { again: 1, down: 0, good: 1, great: 0 },
  });
});

test("undo: restoring the previous state undoes level and queue", () => {
  // The UI undoes by putting the previous state back and dropping the held
  // answer; check that the previous state is untouched by answering.
  const before = startSession(cards(5, 5, 5, 5, 5, 5, 5));
  const snapshot = structuredClone(before);
  const after = answerCard(before, "again")!.state;
  assert.notDeepEqual(after, before);
  assert.deepEqual(before, snapshot);
  assert.equal(before.queue[0].reviewLevel, 5);
});

test("practice: a miss re-queues 5 later without changing the level", () => {
  let s = startSession(cards(5, 5, 5, 5, 5, 5, 5, 5));
  s = practiceCard(s, false)!;
  assert.deepEqual(ids(s.queue), [1, 2, 3, 4, 5, 1, 6, 7, 8]);
  assert.equal(s.queue[5].reviewLevel, 5);
  assert.deepEqual(s.missed, [1]);
  s = practiceCard(s, true)!;
  assert.equal(s.queue.length, 9);
});

test("answering past the end returns null", () => {
  const s = startSession<SessionCard>([]);
  assert.equal(answerCard(s, "good"), null);
  assert.equal(practiceCard(s, true), null);
});
