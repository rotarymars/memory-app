import Link from "next/link";
import { dueCards } from "@/lib/cards";
import { ReviewSession } from "./ReviewSession";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const cards = await dueCards();

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <div className="text-5xl">✨</div>
        <h1 className="text-2xl font-semibold tracking-tight">
          You&apos;re all caught up.
        </h1>
        <p className="text-[var(--muted)] max-w-md">
          No cards are due right now. Cards re-appear here once their next
          review date arrives.
        </p>
        <div className="flex gap-2 mt-2">
          <Link
            href="/cards/new"
            className="inline-flex h-10 items-center rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-foreground)] hover:opacity-90"
          >
            Add a card
          </Link>
          <Link
            href="/"
            className="inline-flex h-10 items-center rounded-md border border-[var(--border)] bg-[var(--card)] px-4 text-sm font-medium hover:bg-black/[.04] dark:hover:bg-white/[.06]"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ReviewSession
      initialCards={cards.map((c) => ({
        id: c.id,
        front: c.front,
        back: c.back,
        tag: c.tag,
        reviewLevel: c.reviewLevel,
      }))}
    />
  );
}
