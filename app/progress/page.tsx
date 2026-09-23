import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth";
import { progressRows } from "@/lib/cards";
import {
  formatDuration,
  summarizeProgress,
  type TagProgress,
} from "@/lib/progress";
import {
  formatInterval,
  intervalMinutesForLevel,
  MATURE_LEVEL,
} from "@/lib/spaced-repetition";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const userId = await getUserId();
  if (!userId) redirect("/sign-in");
  const { tags, overall } = summarizeProgress(await progressRows(userId));

  if (overall.total === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          No progress to show yet.
        </h1>
        <p className="max-w-md text-[var(--muted)]">
          Add some cards and review them — this page tracks how well you recall
          each tag and how long until everything is mature.
        </p>
        <Link
          href="/cards/new"
          className="mt-2 inline-flex h-10 items-center rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-foreground)] hover:opacity-90"
        >
          Add a card
        </Link>
      </div>
    );
  }

  const matureInterval = formatInterval(intervalMinutesForLevel(MATURE_LEVEL));

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Progress</h1>
        <p className="text-[var(--muted)]">
          A card is mature once it&apos;s scheduled {matureInterval} or more
          out. Time estimates assume you review cards as they come due, and
          answer the way you have so far.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat
          label="Recall rate"
          value={formatRate(overall.recallRate)}
          detail={
            overall.reviews > 0
              ? `${overall.reviews} answers`
              : "No answers recorded yet"
          }
        />
        <Stat
          label="Mature"
          value={`${Math.round((overall.mature / overall.total) * 100)}%`}
          detail={`${overall.mature} of ${overall.total} cards`}
        />
        <Stat
          label="All mature in"
          value={
            overall.msToMature > 0
              ? `≈ ${formatDuration(overall.msToMature)}`
              : "Done"
          }
          detail={
            overall.msToMature > 0
              ? "if you keep reviewing"
              : "Every card is mature"
          }
        />
        <Stat
          label="Reviews to go"
          value={`≈ ${overall.reviewsToMature}`}
          detail="until all are mature"
        />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
            By tag
          </h2>
          <Legend />
        </div>
        {overall.reviews === 0 && (
          <p className="text-sm text-[var(--muted)]">
            Recall rates fill in as you review. Until then, estimates assume
            you get about 8 in 10 right.
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {tags.map((t) => (
            <TagRow key={t.tag ?? ""} progress={t} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function TagRow({ progress: t }: { progress: TagProgress }) {
  const reviewHref = t.tag
    ? `/review?tag=${encodeURIComponent(t.tag)}`
    : "/review";
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col">
          <span
            className={`truncate text-sm font-medium ${
              t.tag ? "" : "italic text-[var(--muted)]"
            }`}
          >
            {t.tag ?? "Untagged"}
          </span>
          <span className="text-xs text-[var(--muted)]">
            {t.total} card{t.total === 1 ? "" : "s"} ·{" "}
            {t.msToMature > 0
              ? `all mature in ≈ ${formatDuration(t.msToMature)} (~${t.reviewsToMature} reviews)`
              : "all mature"}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <div
              className="text-xl font-semibold tabular-nums"
              style={{ color: rateColor(t.recallRate) }}
            >
              {formatRate(t.recallRate)}
            </div>
            <div className="text-xs text-[var(--muted)]">
              {t.reviews > 0 ? `recall · ${t.reviews} answers` : "no answers yet"}
            </div>
          </div>
          {t.tag && (
            <Link
              href={reviewHref}
              className="rounded-md px-2 py-1 text-xs text-[var(--muted)] hover:bg-black/[.04] hover:text-[var(--foreground)] dark:hover:bg-white/[.06]"
            >
              Review
            </Link>
          )}
        </div>
      </div>

      <StageBar progress={t} />

      {t.reviews > 0 && (
        <div className="flex flex-wrap gap-x-3 text-xs text-[var(--muted)]">
          <span>
            <span className="text-[var(--danger)]">Again</span> {t.counts.again}
          </span>
          <span>
            <span className="text-[var(--warning)]">Hard</span> {t.counts.down}
          </span>
          <span>
            <span className="text-[var(--success)]">Good</span> {t.counts.good}
          </span>
          <span>
            <span className="text-[var(--accent)]">Easy</span> {t.counts.great}
          </span>
        </div>
      )}
    </li>
  );
}

const STAGES = [
  { key: "learning", label: "Learning", color: "var(--warning)" },
  { key: "young", label: "Young", color: "var(--accent)" },
  { key: "mature", label: "Mature", color: "var(--success)" },
] as const;

function StageBar({ progress: t }: { progress: TagProgress }) {
  return (
    <div
      className="flex h-2 w-full gap-px overflow-hidden rounded-full bg-black/[.04] dark:bg-white/[.06]"
      role="img"
      aria-label={STAGES.map((s) => `${t[s.key]} ${s.label.toLowerCase()}`).join(", ")}
    >
      {STAGES.map((s) =>
        t[s.key] > 0 ? (
          <div
            key={s.key}
            title={`${s.label}: ${t[s.key]}`}
            style={{
              width: `${(t[s.key] / t.total) * 100}%`,
              background: s.color,
            }}
          />
        ) : null
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-[var(--muted)]">
      {STAGES.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: s.color }}
          />
          {s.label}
          {s.key === "learning" && " (< 1d)"}
        </span>
      ))}
    </div>
  );
}

function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs text-[var(--muted)]">{detail}</div>
    </div>
  );
}

function formatRate(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

function rateColor(rate: number | null): string {
  if (rate === null) return "var(--muted)";
  if (rate >= 0.85) return "var(--success)";
  if (rate >= 0.7) return "var(--warning)";
  return "var(--danger)";
}
