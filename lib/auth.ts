// Single-user password gate. Auth state lives in a signed cookie.
// Cookie format: `<expires-ms>.<hmac-hex>` where the HMAC covers `<expires-ms>`.

const SESSION_COOKIE = "mem_session";
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const SESSION_COOKIE_NAME = SESSION_COOKIE;

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "SESSION_SECRET is missing or too short. Set it to a 32+ char random string."
    );
  }
  return secret;
}

function getPassword(): string {
  const pw = process.env.APP_PASSWORD;
  if (!pw) {
    throw new Error("APP_PASSWORD is not set.");
  }
  return pw;
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmac(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return bufToHex(sig);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function checkPassword(submitted: string): Promise<boolean> {
  const expected = getPassword();
  // Hash both sides to keep comparison length-independent.
  const secret = getSecret();
  const [a, b] = await Promise.all([
    hmac(submitted, secret),
    hmac(expected, secret),
  ]);
  return timingSafeEqual(a, b);
}

export async function createSessionToken(
  ttlMs: number = DEFAULT_TTL_MS
): Promise<string> {
  const expiresAt = Date.now() + ttlMs;
  const sig = await hmac(String(expiresAt), getSecret());
  return `${expiresAt}.${sig}`;
}

export async function verifySessionToken(
  token: string | undefined | null
): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const expiresStr = token.slice(0, dot);
  const providedSig = token.slice(dot + 1);
  const expiresAt = Number(expiresStr);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  let expectedSig: string;
  try {
    expectedSig = await hmac(expiresStr, getSecret());
  } catch {
    return false;
  }
  return timingSafeEqual(providedSig, expectedSig);
}

export const SESSION_MAX_AGE_SECONDS = Math.floor(DEFAULT_TTL_MS / 1000);
