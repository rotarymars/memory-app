import { NextResponse } from "next/server";
import { createCard, listCards } from "@/lib/cards";
import { parseBearer, verifyApiToken } from "@/lib/api-tokens";

export const runtime = "nodejs";

async function authorize(req: Request): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: Response }
> {
  const raw = parseBearer(req.headers.get("authorization"));
  if (!raw) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Missing Authorization header. Use: Bearer <token>" },
        { status: 401 }
      ),
    };
  }
  const verified = await verifyApiToken(raw);
  if (!verified) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid or revoked token." },
        { status: 401 }
      ),
    };
  }
  return { ok: true, userId: verified.userId };
}

function trimOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function POST(req: Request) {
  const auth = await authorize(req);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Body must be valid JSON." },
      { status: 400 }
    );
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Body must be an object." },
      { status: 400 }
    );
  }

  const record = body as Record<string, unknown>;
  const front = trimOrNull(record.front);
  const back = trimOrNull(record.back);
  const tag = trimOrNull(record.tag);

  if (!front || !back) {
    return NextResponse.json(
      { error: "Both 'front' and 'back' are required, non-empty strings." },
      { status: 422 }
    );
  }

  const card = await createCard({
    userId: auth.userId,
    front,
    back,
    tag,
  });

  return NextResponse.json(
    {
      id: card.id,
      front: card.front,
      back: card.back,
      tag: card.tag,
      reviewLevel: card.reviewLevel,
      nextReviewAt: card.nextReviewAt,
      createdAt: card.createdAt,
    },
    { status: 201 }
  );
}

export async function GET(req: Request) {
  const auth = await authorize(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const tag = trimOrNull(url.searchParams.get("tag"));

  const cards = await listCards(auth.userId, tag);

  return NextResponse.json({
    cards: cards.map((c) => ({
      id: c.id,
      front: c.front,
      back: c.back,
      tag: c.tag,
      reviewLevel: c.reviewLevel,
      nextReviewAt: c.nextReviewAt,
      lastReviewedAt: c.lastReviewedAt,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
  });
}
