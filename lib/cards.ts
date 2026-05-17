import { asc, desc, eq, lte, sql } from "drizzle-orm";
import { db } from "./db/client";
import { cards, type Card } from "./db/schema";
import { applyReview, type ReviewOutcome } from "./spaced-repetition";

export async function listCards(): Promise<Card[]> {
  return db.select().from(cards).orderBy(desc(cards.createdAt));
}

export async function getCard(id: number): Promise<Card | undefined> {
  const rows = await db.select().from(cards).where(eq(cards.id, id)).limit(1);
  return rows[0];
}

export async function dueCards(now: Date = new Date()): Promise<Card[]> {
  return db
    .select()
    .from(cards)
    .where(lte(cards.nextReviewAt, now))
    .orderBy(asc(cards.nextReviewAt));
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

export async function cardStats(now: Date = new Date()): Promise<CardStats> {
  const rows = await db
    .select({
      total: sql<number>`count(*)::int`,
      due: sql<number>`count(*) filter (where ${cards.nextReviewAt} <= ${now})::int`,
      learning: sql<number>`count(*) filter (where ${cards.reviewLevel} < 3)::int`,
      mature: sql<number>`count(*) filter (where ${cards.reviewLevel} >= 3)::int`,
    })
    .from(cards);

  return (
    rows[0] ?? { total: 0, due: 0, learning: 0, mature: 0 }
  );
}
