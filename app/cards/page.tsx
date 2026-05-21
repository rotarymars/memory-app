import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { listCards, listTagSummaries } from "@/lib/cards";
import {
  formatInterval,
  formatTimeUntil,
  intervalMinutesForLevel,
} from "@/lib/spaced-repetition";
import CardList, { type CardRow } from "./CardList";

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

  const now = new Date();
  const rows: CardRow[] = cards.map((card) => {
    const isDue = card.nextReviewAt <= now;
    return {
      id: card.id,
      front: card.front,
      back: card.back,
      tag: card.tag,
      reviewLevel: card.reviewLevel,
      intervalLabel: formatInterval(intervalMinutesForLevel(card.reviewLevel)),
      isDue,
      nextLabel: isDue
        ? "Due now"
        : `Next in ${formatTimeUntil(card.nextReviewAt, now)}`,
      nextReviewTitle: card.nextReviewAt.toLocaleString(),
    };
  });

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
              {t.tag} <span className="opacity-60">({t.total})</span>
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

      {rows.length === 0 ? (
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
        <CardList cards={rows} />
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
