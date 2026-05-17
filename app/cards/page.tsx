import Link from "next/link";
import { listCards } from "@/lib/cards";
import { deleteCardAction } from "@/app/actions";
import {
  formatInterval,
  intervalDaysForLevel,
} from "@/lib/spaced-repetition";

export const dynamic = "force-dynamic";

export default async function CardsPage() {
  const cards = await listCards();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">All cards</h1>
        <Link
          href="/cards/new"
          className="inline-flex h-9 items-center rounded-md bg-[var(--accent)] px-3 text-sm font-medium text-[var(--accent-foreground)] hover:opacity-90"
        >
          New card
        </Link>
      </div>

      {cards.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-12 text-center">
          <p className="text-[var(--muted)]">No cards yet.</p>
          <Link
            href="/cards/new"
            className="mt-3 inline-flex items-center text-sm font-medium text-[var(--accent)] hover:underline"
          >
            Create your first one →
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {cards.map((card) => {
            const isDue = card.nextReviewAt <= new Date();
            const interval = intervalDaysForLevel(card.reviewLevel);
            return (
              <li
                key={card.id}
                className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
                          isDue
                            ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                            : "bg-black/[.04] dark:bg-white/[.06]"
                        }`}
                      >
                        L{card.reviewLevel} · {formatInterval(interval)}
                      </span>
                      {card.tag && (
                        <span className="rounded-full bg-black/[.04] px-2 py-0.5 dark:bg-white/[.06]">
                          {card.tag}
                        </span>
                      )}
                      <span>
                        {isDue
                          ? "Due now"
                          : `Next: ${card.nextReviewAt.toLocaleDateString()}`}
                      </span>
                    </div>
                    <div className="mt-2 text-sm font-medium leading-6">
                      {card.front}
                    </div>
                    <div className="mt-1 text-sm text-[var(--muted)] leading-6 line-clamp-2">
                      {card.back}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Link
                      href={`/cards/${card.id}/edit`}
                      className="rounded-md px-2 py-1 text-xs font-medium text-[var(--muted)] hover:bg-black/[.04] hover:text-[var(--foreground)] dark:hover:bg-white/[.06]"
                    >
                      Edit
                    </Link>
                    <form action={deleteCardAction}>
                      <input type="hidden" name="id" value={card.id} />
                      <button
                        type="submit"
                        className="rounded-md px-2 py-1 text-xs font-medium text-[var(--muted)] hover:bg-[var(--danger)]/10 hover:text-[var(--danger)]"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
