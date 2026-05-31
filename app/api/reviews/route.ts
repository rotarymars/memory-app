import { auth } from "@clerk/nextjs/server";
import { applyReviewStates, type ReviewState } from "@/lib/cards";

export const runtime = "nodejs";

// Upper bound on a single batch — a session is normally a handful of cards, so
// this is just a guard against a malformed or abusive payload.
const MAX_BATCH = 1000;

// Records review results for the signed-in user. Serves both the review
// session's background flush (fetch) and its close-tab flush (sendBeacon),
// which is why it lives behind Clerk's session-cookie auth rather than the
// bearer-token scheme used by /api/cards.
export async function POST(req: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Body must be valid JSON.", { status: 400 });
  }

  const reviews = (body as { reviews?: unknown })?.reviews;
  if (!Array.isArray(reviews)) {
    return new Response("Expected a 'reviews' array.", { status: 400 });
  }

  const states: ReviewState[] = reviews
    .filter(
      (r): r is { id: unknown; level: unknown } =>
        typeof r === "object" && r !== null
    )
    .map((r) => ({ id: Number(r.id), level: Number(r.level) }))
    .filter((s) => Number.isFinite(s.id) && Number.isFinite(s.level))
    .slice(0, MAX_BATCH);

  await applyReviewStates(userId, states);

  return new Response(null, { status: 204 });
}
