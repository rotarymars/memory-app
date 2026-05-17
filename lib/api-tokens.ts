import { and, desc, eq } from "drizzle-orm";
import { db } from "./db/client";
import { apiTokens, type ApiToken } from "./db/schema";

const TOKEN_PREFIX = "mem_";
const TOKEN_BYTES = 32;

function bufToHex(buf: ArrayBuffer | Uint8Array): string {
  const arr = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < arr.length; i++) {
    out += arr[i].toString(16).padStart(2, "0");
  }
  return out;
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token)
  );
  return bufToHex(digest);
}

function previewFor(token: string): string {
  return `${token.slice(0, 8)}…${token.slice(-4)}`;
}

export async function generateToken(): Promise<{
  token: string;
  hash: string;
  preview: string;
}> {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  const token = `${TOKEN_PREFIX}${bufToHex(bytes)}`;
  const hash = await hashToken(token);
  return { token, hash, preview: previewFor(token) };
}

export async function createApiToken(input: {
  userId: string;
  name: string;
}): Promise<{ token: string; row: ApiToken }> {
  const { token, hash, preview } = await generateToken();
  const [row] = await db
    .insert(apiTokens)
    .values({
      userId: input.userId,
      name: input.name,
      tokenHash: hash,
      tokenPreview: preview,
    })
    .returning();
  return { token, row };
}

export async function listApiTokens(userId: string): Promise<ApiToken[]> {
  return db
    .select()
    .from(apiTokens)
    .where(eq(apiTokens.userId, userId))
    .orderBy(desc(apiTokens.createdAt));
}

export async function deleteApiToken(
  userId: string,
  id: number
): Promise<void> {
  await db
    .delete(apiTokens)
    .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, userId)));
}

export async function verifyApiToken(
  rawToken: string
): Promise<{ userId: string; tokenId: number } | null> {
  if (!rawToken.startsWith(TOKEN_PREFIX)) return null;
  const hash = await hashToken(rawToken);
  const rows = await db
    .select({ id: apiTokens.id, userId: apiTokens.userId })
    .from(apiTokens)
    .where(eq(apiTokens.tokenHash, hash))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  // Update lastUsedAt opportunistically; don't block the request on it.
  void db
    .update(apiTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiTokens.id, row.id))
    .catch(() => {});
  return { userId: row.userId, tokenId: row.id };
}

export function parseBearer(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return match ? match[1].trim() : null;
}
