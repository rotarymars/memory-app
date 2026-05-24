import { and, asc, desc, eq, inArray, lte, sql, type SQL } from "drizzle-orm";
import { db } from "./db/client";
import { cards, type Card } from "./db/schema";
import { applyReview, type ReviewOutcome } from "./spaced-repetition";

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

export async function recordReview(
  userId: string,
  id: number,
  outcome: ReviewOutcome
): Promise<Card | undefined> {
  const card = await getCard(userId, id);
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
    .where(and(eq(cards.id, id), userFilter(userId)))
    .returning();
  return row;
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
      learning: sql<number>`count(*) filter (where ${cards.reviewLevel} < 3)::int`,
      mature: sql<number>`count(*) filter (where ${cards.reviewLevel} >= 3)::int`,
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
