// Creates an account. Prompts for the password so it never lands in shell
// history.
//
//   npm run user:create -- <username>
//   npm run user:create -- <username> --id <existing user id>
//
// --id reuses an existing user id (e.g. an old Clerk `user_…` id from
// `npm run user:list`), so the cards and API tokens it owns belong to the new
// account.

import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { count, eq } from "drizzle-orm";
import {
  hashPassword,
  MIN_PASSWORD_LENGTH,
  normalizeUsername,
  USERNAME_PATTERN,
} from "../lib/password";
import { confirm, fail, loadDb, promptHidden } from "./shared";

const USAGE =
  "Usage: npm run user:create -- <username> [--id <existing user id>]";

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { id: { type: "string" } },
  });
  if (positionals.length !== 1) fail(USAGE);

  const username = normalizeUsername(positionals[0]);
  if (!USERNAME_PATTERN.test(username)) {
    fail(
      "Username must be 3–32 characters: lowercase letters, digits, '_' or '-'."
    );
  }
  const requestedId = values.id?.trim();
  if (values.id !== undefined && !requestedId) fail("--id can't be empty.");

  const { db, users, cards, apiTokens } = await loadDb();

  const [taken] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username));
  if (taken) fail(`Username "${username}" is already taken.`);

  if (requestedId) {
    const [existing] = await db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.id, requestedId));
    if (existing) {
      fail(`Id ${requestedId} already belongs to "${existing.username}".`);
    }
    const [[cardCount], [tokenCount]] = await Promise.all([
      db
        .select({ n: count() })
        .from(cards)
        .where(eq(cards.userId, requestedId)),
      db
        .select({ n: count() })
        .from(apiTokens)
        .where(eq(apiTokens.userId, requestedId)),
    ]);
    if (cardCount.n === 0 && tokenCount.n === 0) {
      console.log(
        `No cards or API tokens belong to ${requestedId} — check it against \`npm run user:list\`.`
      );
      if (!(await confirm("Create the account with this id anyway?"))) {
        fail("Cancelled.");
      }
    } else {
      console.log(
        `${cardCount.n} card(s) and ${tokenCount.n} API token(s) will belong to "${username}".`
      );
    }
  }

  const password = await promptHidden(`Password for "${username}": `);
  if (password.length < MIN_PASSWORD_LENGTH) {
    fail(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if ((await promptHidden("Repeat password: ")) !== password) {
    fail("Passwords don't match.");
  }

  const id = requestedId ?? randomUUID();
  await db.insert(users).values({
    id,
    username,
    passwordHash: await hashPassword(password),
  });
  console.log(`Created "${username}" (id ${id}).`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
