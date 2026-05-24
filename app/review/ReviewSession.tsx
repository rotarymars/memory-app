"use client";

import Link from "next/link";
import { useState, useTransition, useEffect } from "react";
import { reviewCardAction } from "@/app/actions";
import {
  formatInterval,
  intervalMinutesForLevel,
  MAX_LEVEL,
} from "@/lib/spaced-repetition";

type ReviewCard = {
  id: number;
  front: string;
  back: string;
  tag: string | null;
  reviewLevel: number;
  frontImageUrl: string | null;
  backImageUrl: string | null;
};

export function ReviewSession({
  initialCards,
  tag,
}: {
  initialCards: ReviewCard[];
  tag?: string | null;
}) {
  const [queue, setQueue] = useState(initialCards);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [isPending, startTransition] = useTransition();

  const current = queue[index];
  const remaining = queue.length - index;

  function answer(outcome: "good" | "again") {
    if (!current || isPending) return;
    const formData = new FormData();
    formData.set("id", String(current.id));
    formData.set("outcome", outcome);
    startTransition(async () => {
      await reviewCardAction(formData);
      // On "again", re-queue at the end so it appears later in the session.
      if (outcome === "again") {
        setQueue((q) => [...q, current]);
      }
      setCompleted((c) => c + 1);
      setIndex((i) => i + 1);
      setRevealed(false);
    });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      if (e.target instanceof HTMLTextAreaElement) return;
      if (!revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed && (e.key === "1" || e.key === "j")) {
        e.preventDefault();
        answer("again");
      } else if (revealed && (e.key === "2" || e.key === "k")) {
        e.preventDefault();
        answer("good");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, index, queue, isPending]);

  if (!current) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <div className="text-5xl">🎉</div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Session complete.
        </h1>
        <p className="text-[var(--muted)]">
          You reviewed {completed} card{completed === 1 ? "" : "s"}.
        </p>
        <div className="flex gap-2 mt-2">
          <Link
            href="/"
            className="inline-flex h-10 items-center rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-foreground)] hover:opacity-90"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const currentInterval = intervalMinutesForLevel(current.reviewLevel);
  const nextGoodInterval = intervalMinutesForLevel(
    Math.min(current.reviewLevel + 1, MAX_LEVEL)
  );
  const againInterval = intervalMinutesForLevel(0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between text-xs text-[var(--muted)]">
        <div className="flex items-center gap-2">
          {tag && (
            <span className="inline-flex items-center rounded-full bg-[var(--accent)]/10 px-2 py-0.5 font-medium text-[var(--accent)]">
              {tag}
            </span>
          )}
          <span>
            {completed + 1} / {completed + remaining}
          </span>
          <span
            className="inline-flex items-center rounded-full bg-black/[.04] px-2 py-0.5 dark:bg-white/[.06]"
          >
            L{current.reviewLevel} · {formatInterval(currentInterval)}
          </span>
          {current.tag && (
            <span className="rounded-full bg-black/[.04] px-2 py-0.5 dark:bg-white/[.06]">
              {current.tag}
            </span>
          )}
        </div>
        <Link href="/" className="hover:underline">
          End session
        </Link>
      </div>

      <div
        className="relative cursor-pointer select-none rounded-xl border border-[var(--border)] bg-[var(--card)] p-10 shadow-sm transition-shadow hover:shadow-md"
        onClick={() => !revealed && setRevealed(true)}
      >
        <div className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
          Front
        </div>
        <div className="mt-2 whitespace-pre-wrap text-xl font-medium leading-8">
          {current.front}
        </div>
        {current.frontImageUrl && (
          <div className="mt-4 overflow-hidden rounded-md border border-[var(--border)] bg-black/[.02] dark:bg-white/[.03]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.frontImageUrl}
              alt="Front image"
              className="max-h-96 w-auto"
            />
          </div>
        )}

        {revealed ? (
          <div className="mt-8 border-t border-[var(--border)] pt-6">
            <div className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
              Back
            </div>
            <div className="mt-2 whitespace-pre-wrap text-lg leading-7">
              {current.back}
            </div>
            {current.backImageUrl && (
              <div className="mt-4 overflow-hidden rounded-md border border-[var(--border)] bg-black/[.02] dark:bg-white/[.03]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={current.backImageUrl}
                  alt="Back image"
                  className="max-h-96 w-auto"
                />
              </div>
            )}
          </div>
        ) : (
          <div className="mt-8 text-center text-sm text-[var(--muted)]">
            Click to reveal · or press <Key>Space</Key>
          </div>
        )}
      </div>

      {revealed ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={isPending}
            onClick={() => answer("again")}
            className="flex flex-col items-center rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--danger)]/40 hover:bg-[var(--danger)]/5 disabled:opacity-50"
          >
            <span className="text-sm font-semibold text-[var(--danger)]">
              Again
            </span>
            <span className="mt-1 text-xs text-[var(--muted)]">
              Resets · review in {formatInterval(againInterval)}
            </span>
            <Key className="mt-2">1</Key>
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => answer("good")}
            className="flex flex-col items-center rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--success)]/40 hover:bg-[var(--success)]/5 disabled:opacity-50"
          >
            <span className="text-sm font-semibold text-[var(--success)]">
              Good
            </span>
            <span className="mt-1 text-xs text-[var(--muted)]">
              Next in {formatInterval(nextGoodInterval)}
            </span>
            <Key className="mt-2">2</Key>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 text-sm font-medium hover:bg-black/[.04] dark:hover:bg-white/[.06]"
        >
          Show answer
        </button>
      )}
    </div>
  );
}

function Key({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <kbd
      className={`inline-flex h-5 min-w-5 items-center justify-center rounded border border-[var(--border)] bg-[var(--card)] px-1.5 font-mono text-[10px] text-[var(--muted)] ${className}`}
    >
      {children}
    </kbd>
  );
}
