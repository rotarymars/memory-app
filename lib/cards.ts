import {
  and,
  asc,
  desc,
  eq,
  inArray,
  lte,
  max,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "./db/client";
import { cards, type Card } from "./db/schema";
import {
  MATURE_LEVEL,
  MAX_LEVEL,
  nextReviewDate,
  REVIEW_OUTCOMES,
  type ReviewOutcome,
} from "./spaced-repetition";

function tagFilter(tag: string | null | undefined): SQL | undefined {
  if (tag === undefined) return undefined;
  if (tag === null || tag === "") return undefined;
  return eq(cards.tag, tag);
}

function userFilter(userId: string): SQL {
  return eq(cards.userId, userId);
}

function combineWhere(...parts: (SQL | undefined)[]): SQL | undefined {
  const present = parts.filter((p): p is SQL => p !== undefined);
  if (present.length === 0) return undefined;
  if (present.length === 1) return present[0];
  return and(...present);
}

export async function listCards(
  userId: string,
  tag?: string | null
): Promise<Card[]> {
  const where = combineWhere(userFilter(userId), tagFilter(tag));
  return db.select().from(cards).where(where!).orderBy(desc(cards.createdAt));
}

export async function getCard(
  userId: string,
  id: number
): Promise<Card | undefined> {
  const rows = await db
    .select()
    .from(cards)
    .where(and(eq(cards.id, id), userFilter(userId)))
    .limit(1);
  return rows[0];
}

export async function dueCards(
  userId: string,
  options: { tag?: string | null; now?: Date } = {}
): Promise<Card[]> {
  const now = options.now ?? new Date();
  const where = combineWhere(
    userFilter(userId),
    lte(cards.nextReviewAt, now),
    tagFilter(options.tag)
  );
  return db.select().from(cards).where(where!).orderBy(asc(cards.nextReviewAt));
}

export async function createCard(input: {
  userId: string;
  front: string;
  back: string;
  tag?: string | null;
  frontImageUrl?: string | null;
  backImageUrl?: string | null;
}): Promise<Card> {
  const [row] = await db
    .insert(cards)
    .values({
      userId: input.userId,
      front: input.front,
      back: input.back,
      tag: input.tag ?? null,
      frontImageUrl: input.frontImageUrl ?? null,
      backImageUrl: input.backImageUrl ?? null,
    })
    .returning();
  return row;
}

export async function createCards(input: {
  userId: string;
  cards: { front: string; back: string; tag?: string | null }[];
}): Promise<Card[]> {
  if (input.cards.length === 0) return [];
  return db
    .insert(cards)
    .values(
      input.cards.map((c) => ({
        userId: input.userId,
        front: c.front,
        back: c.back,
        tag: c.tag ?? null,
      }))
    )
    .returning();
}

export async function updateCard(
  userId: string,
  id: number,
  input: {
    front: string;
    back: string;
    tag?: string | null;
    frontImageUrl?: string | null;
    backImageUrl?: string | null;
  }
): Promise<Card | undefined> {
  const [row] = await db
    .update(cards)
    .set({
      front: input.front,
      back: input.back,
      tag: input.tag ?? null,
      frontImageUrl: input.frontImageUrl ?? null,
      backImageUrl: input.backImageUrl ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(cards.id, id), userFilter(userId)))
    .returning();
  return row;
}

export async function deleteCard(userId: string, id: number): Promise<void> {
  await db
    .delete(cards)
    .where(and(eq(cards.id, id), userFilter(userId)));
}

export async function deleteCards(
  userId: string,
  ids: number[]
): Promise<void> {
  if (ids.length === 0) return;
  await db
    .delete(cards)
    .where(and(userFilter(userId), inArray(cards.id, ids)));
}

export type OutcomeCounts = Record<ReviewOutcome, number>;

// `from` and `counts` are optional so a review page loaded before they existed
// can still save levels; such entries just don't add to the tallies.
export type ReviewState = {
  id: number;
  level: number;
  from?: number;
  counts?: OutcomeCounts;
};

const COUNT_FIELDS = {
  again: "againCount",
  down: "downCount",
  good: "goodCount",
  great: "greatCount",
} as const satisfies Record<ReviewOutcome, keyof Card>;

// Guard against a malformed payload inflating the tallies.
const MAX_COUNT_PER_ENTRY = 100;

function clampLevelInput(level: number): number {
  return Math.max(0, Math.min(Math.trunc(level), MAX_LEVEL));
}

// Applies a batch of review results, scoped to the user's own cards. Each
// entry sets the card's absolute review level; the next-review time is derived
// from that level server-side (the client is not trusted with the schedule).
// Writing absolute state makes this idempotent — re-sending the same entry
// (e.g. a retry or a close-tab beacon) leaves the card unchanged.
//
// The outcome tallies are kept idempotent the same way: they're only added
// when the card is still at `from`, the level the answers started from. Once
// an entry has landed the card has moved on, so a duplicate adds nothing. (The
// exception is an answer that doesn't move the level, like "again" at level
// 0 — a duplicate of that is counted twice. It's rare and only skews stats.)
export async function applyReviewStates(
  userId: string,
  states: ReviewState[]
): Promise<void> {
  // Coalesce by id so the last result for a card wins within the batch.
  const byId = new Map<number, ReviewState>();
  for (const s of states) {
    if (!Number.isFinite(s.id) || !Number.isFinite(s.level)) continue;
    byId.set(s.id, { ...s, level: clampLevelInput(s.level) });
  }
  if (byId.size === 0) return;

  const now = new Date();
  await Promise.all(
    Array.from(byId, ([id, s]) => {
      const tallies: Partial<Record<(typeof COUNT_FIELDS)[ReviewOutcome], SQL>> =
        {};
      if (s.counts && s.from !== undefined && Number.isFinite(s.from)) {
        const from = clampLevelInput(s.from);
        for (const outcome of REVIEW_OUTCOMES) {
          const n = Math.trunc(s.counts[outcome]);
          if (!(n > 0)) continue;
          const field = COUNT_FIELDS[outcome];
          const col = cards[field];
          tallies[field] = sql`case when ${cards.reviewLevel} = ${from} then ${col} + ${Math.min(n, MAX_COUNT_PER_ENTRY)} else ${col} end`;
        }
      }
      return db
        .update(cards)
        .set({
          reviewLevel: s.level,
          nextReviewAt: nextReviewDate(s.level, now),
          lastReviewedAt: now,
          updatedAt: now,
          ...tallies,
        })
        .where(and(eq(cards.id, id), userFilter(userId)));
    })
  );
}

export type CardStats = {
  total: number;
  due: number;
  learning: number;
  mature: number;
};

export async function cardStats(
  userId: string,
  options: { tag?: string | null; now?: Date } = {}
): Promise<CardStats> {
  const now = options.now ?? new Date();
  const where = combineWhere(userFilter(userId), tagFilter(options.tag));
  const rows = await db
    .select({
      total: sql<number>`count(*)::int`,
      due: sql<number>`count(*) filter (where ${cards.nextReviewAt} <= ${now})::int`,
      learning: sql<number>`count(*) filter (where ${cards.reviewLevel} < ${MATURE_LEVEL})::int`,
      mature: sql<number>`count(*) filter (where ${cards.reviewLevel} >= ${MATURE_LEVEL})::int`,
    })
    .from(cards)
    .where(where!);
  return rows[0] ?? { total: 0, due: 0, learning: 0, mature: 0 };
}

export type TagSummary = {
  tag: string;
  total: number;
  due: number;
};

export async function listTagSummaries(
  userId: string,
  now: Date = new Date()
): Promise<TagSummary[]> {
  const rows = await db
    .select({
      tag: cards.tag,
      total: sql<number>`count(*)::int`,
      due: sql<number>`count(*) filter (where ${cards.nextReviewAt} <= ${now})::int`,
    })
    .from(cards)
    .where(
      and(
        userFilter(userId),
        sql`${cards.tag} is not null and ${cards.tag} <> ''`
      )
    )
    .groupBy(cards.tag)
    .orderBy(asc(cards.tag));

  return rows
    .filter((r): r is { tag: string; total: number; due: number } => r.tag !== null)
    .map((r) => ({ tag: r.tag, total: r.total, due: r.due }));
}

// One row per (tag, level) — at most 16 per tag — with the outcome tallies
// summed. That's everything the progress page needs, so it never loads
// individual cards. `lastDueAt` is the latest next-review time in the group,
// which is what bounds how long that group takes to mature.
export type ProgressRow = {
  tag: string | null;
  level: number;
  cards: number;
  lastDueAt: Date;
  counts: OutcomeCounts;
};

export async function progressRows(userId: string): Promise<ProgressRow[]> {
  const tag = sql<string | null>`nullif(${cards.tag}, '')`;
  const rows = await db
    .select({
      tag,
      level: cards.reviewLevel,
      cards: sql<number>`count(*)::int`,
      lastDueAt: max(cards.nextReviewAt),
      again: sql<number>`sum(${cards.againCount})::int`,
      down: sql<number>`sum(${cards.downCount})::int`,
      good: sql<number>`sum(${cards.goodCount})::int`,
      great: sql<number>`sum(${cards.greatCount})::int`,
    })
    .from(cards)
    .where(userFilter(userId))
    .groupBy(tag, cards.reviewLevel);

  return rows.map((r) => ({
    tag: r.tag,
    level: r.level,
    cards: r.cards,
    lastDueAt: r.lastDueAt ?? new Date(),
    counts: { again: r.again, down: r.down, good: r.good, great: r.great },
  }));
}
