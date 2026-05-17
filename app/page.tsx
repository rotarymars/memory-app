import Link from "next/link";
import { cardStats, listTagSummaries } from "@/lib/cards";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [stats, tags] = await Promise.all([
    cardStats(),
    listTagSummaries(),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome back.
        </h1>
        <p className="text-[var(--muted)]">
          {stats.due > 0
            ? `You have ${stats.due} card${stats.due === 1 ? "" : "s"} ready to review.`
            : "Nothing's due right now. Add a card or check back tomorrow."}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link
            href="/review"
            className="inline-flex h-10 items-center rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-90"
          >
            {stats.due > 0 ? `Review ${stats.due} due` : "Review"}
          </Link>
          <Link
            href="/cards/new"
            className="inline-flex h-10 items-center rounded-md border border-[var(--border)] bg-[var(--card)] px-4 text-sm font-medium hover:bg-black/[.04] dark:hover:bg-white/[.06]"
          >
            New card
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Due now" value={stats.due} accent />
        <StatCard label="Learning" value={stats.learning} />
        <StatCard label="Mature" value={stats.mature} />
        <StatCard label="Total" value={stats.total} />
      </section>

      {tags.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
            By tag
          </h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {tags.map((t) => (
              <li
                key={t.tag}
                className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--card)] p-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="truncate text-sm font-medium">
                    {t.tag}
                  </span>
                  <span className="text-xs text-[var(--muted)] whitespace-nowrap">
                    {t.due} due · {t.total} total
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Link
                    href={`/cards?tag=${encodeURIComponent(t.tag)}`}
                    className="rounded-md px-2 py-1 text-xs text-[var(--muted)] hover:bg-black/[.04] hover:text-[var(--foreground)] dark:hover:bg-white/[.06]"
                  >
                    Browse
                  </Link>
                  <Link
                    href={`/review?tag=${encodeURIComponent(t.tag)}`}
                    className={`rounded-md px-2 py-1 text-xs font-medium ${
                      t.due > 0
                        ? "bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90"
                        : "text-[var(--muted)] hover:bg-black/[.04] dark:hover:bg-white/[.06]"
                    }`}
                  >
                    Review
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
          How the schedule works
        </h2>
        <p className="mt-3 text-sm leading-6">
          New cards are due immediately. Each time you recall a card correctly,
          its next review moves further out — 1 day, then 2, 4, 7, 15, 30, 60,
          120, 240 days. If you forget, the card resets to the start of the
          ladder so you see it tomorrow.
        </p>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        accent
          ? "border-[var(--accent)]/40 bg-[var(--accent)]/5"
          : "border-[var(--border)] bg-[var(--card)]"
      }`}
    >
      <div className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
