import Link from "next/link";
import { getUserId } from "@/lib/auth";
import { redirect } from "next/navigation";
import { dueCards, listCards } from "@/lib/cards";
import { orderCards, parseReviewOrder } from "@/lib/review-order";
import { ReviewSession } from "./ReviewSession";

export const dynamic = "force-dynamic";

function reviewHref(params: { tag?: string | null; practice?: boolean }) {
  const q = new URLSearchParams();
  if (params.practice) q.set("mode", "practice");
  if (params.tag) q.set("tag", params.tag);
  const s = q.toString();
  return s ? `/review?${s}` : "/review";
}

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; mode?: string; order?: string }>;
}) {
  const userId = await getUserId();
  if (!userId) redirect("/sign-in");
  const { tag: rawTag, mode, order: rawOrder } = await searchParams;
  const tag = rawTag && rawTag.length > 0 ? rawTag : null;
  const order = parseReviewOrder(rawOrder);
  // Practice mode goes through every card and never saves results, so
  // cramming right before a test doesn't push cards far into the future.
  const practice = mode === "practice";
  const cards = orderCards(
    practice ? await listCards(userId, tag) : await dueCards(userId, { tag }),
    order
  );

  if (cards.length === 0 && practice) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <div className="text-5xl">📭</div>
        <h1 className="text-2xl font-semibold tracking-tight">
          No cards to practice.
        </h1>
        <div className="flex gap-2 mt-2">
          <Link
            href="/cards/new"
            className="inline-flex h-10 items-center rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-foreground)] hover:opacity-90"
          >
            Add a card
          </Link>
        </div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <div className="text-5xl">✨</div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {tag ? (
            <>
              Nothing due for{" "}
              <span className="font-mono text-[var(--accent)]">{tag}</span>.
            </>
          ) : (
            "You're all caught up."
          )}
        </h1>
        <p className="text-[var(--muted)] max-w-md">
          {tag
            ? "No cards with this tag are due right now."
            : "No cards are due right now. Cards re-appear here once their next review date arrives."}
        </p>
        <div className="flex flex-wrap justify-center gap-2 mt-2">
          <Link
            href={reviewHref({ tag, practice: true })}
            className="inline-flex h-10 items-center rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-foreground)] hover:opacity-90"
          >
            Practice {tag ? "this tag" : "all cards"} anyway
          </Link>
          {tag && (
            <Link
              href="/review"
              className="inline-flex h-10 items-center rounded-md border border-[var(--border)] bg-[var(--card)] px-4 text-sm font-medium hover:bg-black/[.04] dark:hover:bg-white/[.06]"
            >
              Review all due
            </Link>
          )}
          <Link
            href="/cards/new"
            className="inline-flex h-10 items-center rounded-md border border-[var(--border)] bg-[var(--card)] px-4 text-sm font-medium hover:bg-black/[.04] dark:hover:bg-white/[.06]"
          >
            Add a card
          </Link>
          <Link
            href="/"
            className="inline-flex h-10 items-center rounded-md border border-[var(--border)] bg-[var(--card)] px-4 text-sm font-medium hover:bg-black/[.04] dark:hover:bg-white/[.06]"
          >
            Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ReviewSession
      tag={tag}
      practice={practice}
      initialOrder={order}
      initialCards={cards.map((c) => ({
        id: c.id,
        front: c.front,
        back: c.back,
        tag: c.tag,
        reviewLevel: c.reviewLevel,
        frontImageUrl: c.frontImageUrl,
        backImageUrl: c.backImageUrl,
      }))}
    />
  );
}
