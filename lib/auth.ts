import { randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { and, eq, gt, lte } from "drizzle-orm";
import { db } from "./db/client";
import { sessions, users } from "./db/schema";
import { hashToken } from "./api-tokens";
import { hashPassword, normalizeUsername, verifyPassword } from "./password";
import { SESSION_COOKIE } from "./session-cookie";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// The signed-in user's id, or null. Checks the session against the database,
// so this — not proxy.ts — is the real auth check. Memoized per request.
export const getUserId = cache(async (): Promise<string | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(
      and(
        eq(sessions.id, await hashToken(token)),
        gt(sessions.expiresAt, new Date())
      )
    )
    .limit(1);
  return rows[0]?.userId ?? null;
});

let dummyHash: Promise<string> | undefined;

// Returns the user's id if the credentials match. Unknown usernames still pay
// for a password hash so response time doesn't reveal which usernames exist.
export async function authenticate(
  username: string,
  password: string
): Promise<string | null> {
  const rows = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.username, normalizeUsername(username)))
    .limit(1);
  const user = rows[0];
  if (!user) {
    dummyHash ??= hashPassword("not-a-real-password");
    await verifyPassword(password, await dummyHash);
    return null;
  }
  return (await verifyPassword(password, user.passwordHash)) ? user.id : null;
}

// Only callable from Server Actions and Route Handlers (it sets a cookie).
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({
    id: await hashToken(token),
    userId,
    expiresAt,
  });
  // Housekeeping: drop this user's expired sessions while we're here.
  await db
    .delete(sessions)
    .where(
      and(eq(sessions.userId, userId), lte(sessions.expiresAt, new Date()))
    );
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

// Only callable from Server Actions and Route Handlers (it deletes a cookie).
export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.id, await hashToken(token)));
  }
  cookieStore.delete(SESSION_COOKIE);
}
