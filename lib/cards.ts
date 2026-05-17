import { and, asc, desc, eq, lte, sql, type SQL } from "drizzle-orm";
import { db } from "./db/client";
import { cards, type Card } from "./db/schema";
import { applyReview, type ReviewOutcome } from "./spaced-repetition";

function tagFilter(tag: string | null | undefined): SQL | undefined {
  if (tag === undefined) return undefined;
  if (tag === null || tag === "") return undefined;
  return eq(cards.tag, tag);
}

function combineWhere(...parts: (SQL | undefined)[]): SQL | undefined {
  const present = parts.filter((p): p is SQL => p !== undefined);
  if (present.length === 0) return undefined;
  if (present.length === 1) return present[0];
  return and(...present);
}

export async function listCards(tag?: string | null): Promise<Card[]> {
  const where = tagFilter(tag);
  const q = db.select().from(cards).orderBy(desc(cards.createdAt));
  return where ? q.where(where) : q;
}

export async function getCard(id: number): Promise<Card | undefined> {
  const rows = await db.select().from(cards).where(eq(cards.id, id)).limit(1);
  return rows[0];
}

export async function dueCards(
  options: { tag?: string | null; now?: Date } = {}
): Promise<Card[]> {
  const now = options.now ?? new Date();
  const where = combineWhere(lte(cards.nextReviewAt, now), tagFilter(options.tag));
  const q = db.select().from(cards).orderBy(asc(cards.nextReviewAt));
  return where ? q.where(where) : q;
}

export async function createCard(input: {
  front: string;
  back: string;
  tag?: string | null;
}): Promise<Card> {
  const [row] = await db
    .insert(cards)
    .values({
      front: input.front,
      back: input.back,
      tag: input.tag ?? null,
    })
    .returning();
  return row;
}

export async function updateCard(
  id: number,
  input: { front: string; back: string; tag?: string | null }
): Promise<Card | undefined> {
  const [row] = await db
    .update(cards)
    .set({
      front: input.front,
      back: input.back,
      tag: input.tag ?? null,
      updatedAt: new Date(),
    })
    .where(eq(cards.id, id))
    .returning();
  return row;
}

export async function deleteCard(id: number): Promise<void> {
  await db.delete(cards).where(eq(cards.id, id));
}

export async function recordReview(
  id: number,
  outcome: ReviewOutcome
): Promise<Card | undefined> {
  const card = await getCard(id);
  if (!card) return undefined;

  const now = new Date();
  const { nextLevel, nextReviewAt } = applyReview(card.reviewLevel, outcome, now);

  const [row] = await db
    .update(cards)
    .set({
      reviewLevel: nextLevel,
      nextReviewAt,
      lastReviewedAt: now,
      updatedAt: now,
    })
    .where(eq(cards.id, id))
    .returning();
  return row;
}

export type CardStats = {
  total: number;
  due: number;
  learning: number; // level 0-2
  mature: number; // level 3+
};

export async function cardStats(
  options: { tag?: string | null; now?: Date } = {}
): Promise<CardStats> {
  const now = options.now ?? new Date();
  const where = tagFilter(options.tag);
  const q = db.select({
    total: sql<number>`count(*)::int`,
    due: sql<number>`count(*) filter (where ${cards.nextReviewAt} <= ${now})::int`,
    learning: sql<number>`count(*) filter (where ${cards.reviewLevel} < 3)::int`,
    mature: sql<number>`count(*) filter (where ${cards.reviewLevel} >= 3)::int`,
  }).from(cards);
  const rows = where ? await q.where(where) : await q;
  return rows[0] ?? { total: 0, due: 0, learning: 0, mature: 0 };
}

export type TagSummary = {
  tag: string;
  total: number;
  due: number;
};

export async function listTagSummaries(
  now: Date = new Date()
): Promise<TagSummary[]> {
  const rows = await db
    .select({
      tag: cards.tag,
      total: sql<number>`count(*)::int`,
      due: sql<number>`count(*) filter (where ${cards.nextReviewAt} <= ${now})::int`,
    })
    .from(cards)
    .where(sql`${cards.tag} is not null and ${cards.tag} <> ''`)
    .groupBy(cards.tag)
    .orderBy(asc(cards.tag));

  return rows
    .filter((r): r is { tag: string; total: number; due: number } => r.tag !== null)
    .map((r) => ({ tag: r.tag, total: r.total, due: r.due }));
}
