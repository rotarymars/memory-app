// Deletes an account together with its cards and API tokens, and signs it out
// everywhere.
//
//   npm run user:delete -- <username>
//
// Asks you to type the username to confirm; --yes skips that.

import { parseArgs } from "node:util";
import { count, eq } from "drizzle-orm";
import { normalizeUsername } from "../lib/password";
import { fail, loadDb, prompt } from "./shared";

const USAGE = "Usage: npm run user:delete -- <username> [--yes]";

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { yes: { type: "boolean", default: false } },
  });
  if (positionals.length !== 1) fail(USAGE);
  const username = normalizeUsername(positionals[0]);

  const { db, users, sessions, cards, apiTokens } = await loadDb();

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username));
  if (!user) fail(`No user named "${username}".`);

  const [[cardCount], [tokenCount], [sessionCount]] = await Promise.all([
    db.select({ n: count() }).from(cards).where(eq(cards.userId, user.id)),
    db
      .select({ n: count() })
      .from(apiTokens)
      .where(eq(apiTokens.userId, user.id)),
    db
      .select({ n: count() })
      .from(sessions)
      .where(eq(sessions.userId, user.id)),
  ]);

  console.log(`Deleting "${username}" (id ${user.id}):`);
  console.log(`  - permanently deletes ${cardCount.n} card(s)`);
  console.log(`  - revokes ${tokenCount.n} API token(s)`);
  console.log(`  - signs out ${sessionCount.n} session(s)`);

  if (!values.yes) {
    const typed = await prompt(`Type "${username}" to confirm: `);
    if (normalizeUsername(typed) !== username) fail("Cancelled.");
  }

  // One transaction; sessions go with the user via ON DELETE CASCADE.
  await db.batch([
    db.delete(cards).where(eq(cards.userId, user.id)),
    db.delete(apiTokens).where(eq(apiTokens.userId, user.id)),
    db.delete(users).where(eq(users.id, user.id)),
  ]);

  console.log(`Deleted "${username}".`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
