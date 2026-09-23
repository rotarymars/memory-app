import { getUserId } from "@/lib/auth";
import {
  applyReviewStates,
  type OutcomeCounts,
  type ReviewState,
} from "@/lib/cards";
import { REVIEW_OUTCOMES } from "@/lib/spaced-repetition";

export const runtime = "nodejs";

// Upper bound on a single batch — a session is normally a handful of cards, so
// this is just a guard against a malformed or abusive payload.
const MAX_BATCH = 1000;

// Records review results for the signed-in user. Serves both the review
// session's background flush (fetch) and its close-tab flush (sendBeacon),
// which is why it lives behind the session-cookie auth rather than the
// bearer-token scheme used by /api/cards.
export async function POST(req: Request): Promise<Response> {
  const userId = await getUserId();
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
      (r): r is { id: unknown; level: unknown; from?: unknown; counts?: unknown } =>
        typeof r === "object" && r !== null
    )
    .map((r) => ({
      id: Number(r.id),
      level: Number(r.level),
      from: r.from === undefined ? undefined : Number(r.from),
      counts: parseCounts(r.counts),
    }))
    .filter((s) => Number.isFinite(s.id) && Number.isFinite(s.level))
    .slice(0, MAX_BATCH);

  await applyReviewStates(userId, states);

  return new Response(null, { status: 204 });
}

function parseCounts(value: unknown): OutcomeCounts | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const raw = value as Record<string, unknown>;
  const counts = {} as OutcomeCounts;
  for (const outcome of REVIEW_OUTCOMES) {
    const n = Number(raw[outcome] ?? 0);
    counts[outcome] = Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
  }
  return counts;
}
