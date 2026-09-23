// Lives apart from lib/auth.ts so proxy.ts can read the cookie name without
// pulling in the database client.
export const SESSION_COOKIE = "session";
