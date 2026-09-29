// Sets a new password for an existing account and signs it out everywhere.
// Prompts for the password so it never lands in shell history.
//
//   npm run user:password -- <username>

import { parseArgs } from "node:util";
import { eq } from "drizzle-orm";
import {
  hashPassword,
  MIN_PASSWORD_LENGTH,
  normalizeUsername,
} from "../lib/password";
import { fail, loadDb, promptHidden } from "./shared";

const USAGE = "Usage: npm run user:password -- <username>";

async function main() {
  const { positionals } = parseArgs({ allowPositionals: true });
  if (positionals.length !== 1) fail(USAGE);
  const username = normalizeUsername(positionals[0]);

  const { db, users, sessions } = await loadDb();

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username));
  if (!user) fail(`No user named "${username}".`);

  const password = await promptHidden(`New password for "${username}": `);
  if (password.length < MIN_PASSWORD_LENGTH) {
    fail(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if ((await promptHidden("Repeat password: ")) !== password) {
    fail("Passwords don't match.");
  }

  // One transaction, so the old password's sessions can't outlive it.
  await db.batch([
    db
      .update(users)
      .set({ passwordHash: await hashPassword(password) })
      .where(eq(users.id, user.id)),
    db.delete(sessions).where(eq(sessions.userId, user.id)),
  ]);

  console.log(`Updated the password for "${username}" and signed it out.`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
