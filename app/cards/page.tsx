import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { listCards, listTagSummaries } from "@/lib/cards";
import { deleteCardAction } from "@/app/actions";
import {
  formatInterval,
  intervalMinutesForLevel,
} from "@/lib/spaced-repetition";

export const dynamic = "force-dynamic";

export default async function CardsPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const { tag: rawTag } = await searchParams;
  const tag = rawTag && rawTag.length > 0 ? rawTag : null;
  const [cards, tags] = await Promise.all([
    listCards(userId, tag),
    listTagSummaries(userId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {tag ? (
            <>
              Cards tagged{" "}
              <span className="font-mono text-[var(--accent)]">{tag}</span>
            </>
          ) : (
            "All cards"
          )}
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href="/cards/import"
            className="inline-flex h-9 items-center rounded-md border border-[var(--border)] bg-[var(--card)] px-3 text-sm font-medium hover:bg-black/[.04] dark:hover:bg-white/[.06]"
          >
            Import
          </Link>
          <Link
            href="/cards/new"
            className="inline-flex h-9 items-center rounded-md bg-[var(--accent)] px-3 text-sm font-medium text-[var(--accent-foreground)] hover:opacity-90"
          >
            New card
          </Link>
        </div>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <FilterChip href="/cards" active={tag === null}>
            All
          </FilterChip>
          {tags.map((t) => (
            <FilterChip
              key={t.tag}
              href={`/cards?tag=${encodeURIComponent(t.tag)}`}
              active={tag === t.tag}
            >
              {t.tag}{" "}
              <span className="opacity-60">({t.total})</span>
            </FilterChip>
          ))}
        </div>
      )}

      {tag && (
        <div className="flex items-center justify-between rounded-md border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-4 py-2 text-sm">
          <span>
            Showing only cards tagged{" "}
            <span className="font-mono">{tag}</span>.
          </span>
          <Link
            href={`/review?tag=${encodeURIComponent(tag)}`}
            className="font-medium text-[var(--accent)] hover:underline"
          >
            Review this tag →
          </Link>
        </div>
      )}

      {cards.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-12 text-center">
          <p className="text-[var(--muted)]">
            {tag ? `No cards with tag "${tag}".` : "No cards yet."}
          </p>
          <Link
            href={tag ? "/cards" : "/cards/new"}
            className="mt-3 inline-flex items-center text-sm font-medium text-[var(--accent)] hover:underline"
          >
            {tag ? "Clear filter →" : "Create your first one →"}
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {cards.map((card) => {
            const isDue = card.nextReviewAt <= new Date();
            const interval = intervalMinutesForLevel(card.reviewLevel);
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
                        <Link
                          href={`/cards?tag=${encodeURIComponent(card.tag)}`}
                          className="rounded-full bg-black/[.04] px-2 py-0.5 hover:bg-[var(--accent)]/10 hover:text-[var(--accent)] dark:bg-white/[.06]"
                        >
                          {card.tag}
                        </Link>
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

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
          : "border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:bg-black/[.04] hover:text-[var(--foreground)] dark:hover:bg-white/[.06]"
      }`}
    >
      {children}
    </Link>
  );
}
