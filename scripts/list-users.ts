// Lists accounts, plus any user ids that own cards or API tokens but have no
// account — e.g. users migrated from Clerk who haven't been recreated yet.
//
//   npm run user:list

import { count, max } from "drizzle-orm";
import { loadDb } from "./shared";

async function main() {
  const { db, users, cards, apiTokens } = await loadDb();

  const [accounts, cardCounts, tokenCounts] = await Promise.all([
    db.select().from(users).orderBy(users.createdAt),
    db
      .select({
        userId: cards.userId,
        cards: count(),
        lastCardAdded: max(cards.createdAt),
      })
      .from(cards)
      .groupBy(cards.userId),
    db
      .select({ userId: apiTokens.userId, tokens: count() })
      .from(apiTokens)
      .groupBy(apiTokens.userId),
  ]);

  const cardsBy = new Map(cardCounts.map((c) => [c.userId, c]));
  const tokensBy = new Map(tokenCounts.map((t) => [t.userId, t.tokens]));
  const date = (d: Date | null | undefined) =>
    d ? d.toISOString().slice(0, 10) : "";

  console.log(`Accounts (${accounts.length}):`);
  if (accounts.length > 0) {
    console.table(
      accounts.map((u) => ({
        username: u.username,
        id: u.id,
        created: date(u.createdAt),
        cards: cardsBy.get(u.id)?.cards ?? 0,
        tokens: tokensBy.get(u.id) ?? 0,
      }))
    );
  }

  const accountIds = new Set(accounts.map((u) => u.id));
  const orphanIds = [
    ...new Set([...cardsBy.keys(), ...tokensBy.keys()]),
  ].filter((id) => !accountIds.has(id));

  if (orphanIds.length > 0) {
    console.log(
      `\nData with no account (${orphanIds.length}) — attach with: npm run user:create -- <username> --id <id>`
    );
    console.table(
      orphanIds.map((id) => ({
        id,
        cards: cardsBy.get(id)?.cards ?? 0,
        lastCardAdded: date(cardsBy.get(id)?.lastCardAdded),
        tokens: tokensBy.get(id) ?? 0,
      }))
    );
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
