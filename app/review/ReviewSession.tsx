"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyReview,
  formatInterval,
  intervalMinutesForLevel,
  type ReviewOutcome,
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

type SaveStatus = "idle" | "saving" | "saved" | "error";

const MAX_RETRY_DELAY = 15_000;
const BASE_RETRY_DELAY = 2_000;

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

  // Background save state. The pending map is the source of truth (cardId →
  // latest target level); `pending`/`status` mirror it for rendering only.
  const pendingRef = useRef<Map<number, number>>(new Map());
  const flushingRef = useRef(false);
  const flushRef = useRef<() => void>(() => {});
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelayRef = useRef(BASE_RETRY_DELAY);
  const [pending, setPending] = useState(0);
  const [status, setStatus] = useState<SaveStatus>("idle");

  // Synchronous gate so a card is answered at most once per reveal, even on
  // keyboard autorepeat (the keydown listener closes over stale state).
  const revealedRef = useRef(false);

  const current = queue[index];
  const remaining = queue.length - index;

  const reveal = useCallback(() => {
    revealedRef.current = true;
    setRevealed(true);
  }, []);

  // Drains the pending map to the server. Single-flight: concurrent calls
  // return early, and the in-flight call re-drains anything that piled up.
  const flush = useCallback(async () => {
    if (flushingRef.current) return;
    const batch = Array.from(pendingRef.current, ([id, level]) => ({
      id,
      level,
    }));
    if (batch.length === 0) return;

    flushingRef.current = true;
    setStatus("saving");

    let ok = false;
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reviews: batch }),
        keepalive: true,
      });
      ok = res.ok;
    } catch {
      ok = false;
    } finally {
      flushingRef.current = false;
    }

    if (ok) {
      // Only clear entries that haven't been superseded by a newer answer
      // (the same card can be re-answered while the request was in flight).
      for (const { id, level } of batch) {
        if (pendingRef.current.get(id) === level) pendingRef.current.delete(id);
      }
      retryDelayRef.current = BASE_RETRY_DELAY;
      const left = pendingRef.current.size;
      setPending(left);
      if (left > 0) {
        setStatus("saving");
        queueMicrotask(() => flushRef.current());
      } else {
        setStatus("saved");
      }
    } else {
      setStatus("error");
      if (retryRef.current) clearTimeout(retryRef.current);
      const delay = retryDelayRef.current;
      retryDelayRef.current = Math.min(delay * 2, MAX_RETRY_DELAY);
      retryRef.current = setTimeout(() => flushRef.current(), delay);
    }
  }, []);

  useEffect(() => {
    flushRef.current = () => void flush();
  }, [flush]);

  function answer(outcome: ReviewOutcome) {
    if (!revealedRef.current || !current) return;
    revealedRef.current = false;

    const { nextLevel } = applyReview(current.reviewLevel, outcome);
    pendingRef.current.set(current.id, nextLevel);
    setPending(pendingRef.current.size);
    setStatus("saving");

    // On "again", re-queue the card at its new (reset) level so a later answer
    // in this session computes from the correct level.
    if (outcome === "again") {
      setQueue((q) => [...q, { ...current, reviewLevel: nextLevel }]);
    }
    setCompleted((c) => c + 1);
    setIndex((i) => i + 1);
    setRevealed(false);
    void flush();
  }

  // Keyboard shortcuts: Space/Enter reveals; once revealed, 1-4 grade the card
  // (1 = again/reset, 2 = down, 3 = up, 4 = two up).
  useEffect(() => {
    const grades: Record<string, ReviewOutcome> = {
      "1": "again",
      "2": "down",
      "3": "good",
      "4": "great",
    };
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      if (e.target instanceof HTMLTextAreaElement) return;
      if (!revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        reveal();
      } else if (revealed && grades[e.key]) {
        e.preventDefault();
        answer(grades[e.key]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, index, queue]);

  // Best-effort flush that survives where a normal fetch would be cancelled —
  // tab hide/close, or unmount on client-side navigation. The absolute-state
  // payload is idempotent, so re-sending in-flight entries is harmless.
  const beaconFlush = useCallback(() => {
    if (pendingRef.current.size === 0) return;
    const reviews = Array.from(pendingRef.current, ([id, level]) => ({
      id,
      level,
    }));
    const blob = new Blob([JSON.stringify({ reviews })], {
      type: "application/json",
    });
    navigator.sendBeacon?.("/api/reviews", blob);
  }, []);

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "hidden") beaconFlush();
    }
    window.addEventListener("pagehide", beaconFlush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", beaconFlush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [beaconFlush]);

  // When connectivity returns, retry right away instead of waiting out the
  // backoff timer.
  useEffect(() => {
    function onOnline() {
      if (pendingRef.current.size === 0) return;
      retryDelayRef.current = BASE_RETRY_DELAY;
      if (retryRef.current) clearTimeout(retryRef.current);
      flushRef.current();
    }
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  // Only nag about leaving if saves are actually failing — a healthy session
  // is covered by the beacon above.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (pendingRef.current.size > 0 && status === "error") {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [status]);

  useEffect(
    () => () => {
      if (retryRef.current) clearTimeout(retryRef.current);
      // Salvage anything unsent when navigating away client-side.
      beaconFlush();
    },
    [beaconFlush]
  );

  const retryNow = useCallback(() => {
    retryDelayRef.current = BASE_RETRY_DELAY;
    if (retryRef.current) clearTimeout(retryRef.current);
    void flush();
  }, [flush]);

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
        <SaveSummary
          status={status}
          pending={pending}
          onRetry={retryNow}
        />
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

  // intervalMinutesForLevel clamps to [0, MAX_LEVEL], so over/undershooting the
  // ladder here is safe (e.g. "down" at level 0 stays at level 0).
  const currentInterval = intervalMinutesForLevel(current.reviewLevel);
  const againInterval = intervalMinutesForLevel(0);
  const downInterval = intervalMinutesForLevel(current.reviewLevel - 1);
  const goodInterval = intervalMinutesForLevel(current.reviewLevel + 1);
  const greatInterval = intervalMinutesForLevel(current.reviewLevel + 2);

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
          <span className="inline-flex items-center rounded-full bg-black/[.04] px-2 py-0.5 dark:bg-white/[.06]">
            L{current.reviewLevel} · {formatInterval(currentInterval)}
          </span>
          {current.tag && (
            <span className="rounded-full bg-black/[.04] px-2 py-0.5 dark:bg-white/[.06]">
              {current.tag}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <SaveIndicator status={status} pending={pending} onRetry={retryNow} />
          <Link href="/" className="hover:underline">
            End session
          </Link>
        </div>
      </div>

      <div
        className="relative cursor-pointer select-none rounded-xl border border-[var(--border)] bg-[var(--card)] p-10 shadow-sm transition-shadow hover:shadow-md"
        onClick={() => !revealed && reveal()}
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <button
            type="button"
            onClick={() => answer("again")}
            className="flex flex-col items-center rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--danger)]/40 hover:bg-[var(--danger)]/5"
          >
            <span className="text-sm font-semibold text-[var(--danger)]">
              Again
            </span>
            <span className="mt-1 text-xs text-[var(--muted)]">
              Reset · {formatInterval(againInterval)}
            </span>
            <Key className="mt-2">1</Key>
          </button>
          <button
            type="button"
            onClick={() => answer("down")}
            className="flex flex-col items-center rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--warning)]/40 hover:bg-[var(--warning)]/5"
          >
            <span className="text-sm font-semibold text-[var(--warning)]">
              Hard
            </span>
            <span className="mt-1 text-xs text-[var(--muted)]">
              Down · {formatInterval(downInterval)}
            </span>
            <Key className="mt-2">2</Key>
          </button>
          <button
            type="button"
            onClick={() => answer("good")}
            className="flex flex-col items-center rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--success)]/40 hover:bg-[var(--success)]/5"
          >
            <span className="text-sm font-semibold text-[var(--success)]">
              Good
            </span>
            <span className="mt-1 text-xs text-[var(--muted)]">
              Up · {formatInterval(goodInterval)}
            </span>
            <Key className="mt-2">3</Key>
          </button>
          <button
            type="button"
            onClick={() => answer("great")}
            className="flex flex-col items-center rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/5"
          >
            <span className="text-sm font-semibold text-[var(--accent)]">
              Easy
            </span>
            <span className="mt-1 text-xs text-[var(--muted)]">
              Up ×2 · {formatInterval(greatInterval)}
            </span>
            <Key className="mt-2">4</Key>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={reveal}
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 text-sm font-medium hover:bg-black/[.04] dark:hover:bg-white/[.06]"
        >
          Show answer
        </button>
      )}
    </div>
  );
}

function SaveIndicator({
  status,
  pending,
  onRetry,
}: {
  status: SaveStatus;
  pending: number;
  onRetry: () => void;
}) {
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1 text-[var(--danger)]">
        Couldn&apos;t save{pending > 0 ? ` ${pending}` : ""} — retrying…
        <button
          type="button"
          onClick={onRetry}
          className="font-medium underline hover:no-underline"
        >
          Retry now
        </button>
      </span>
    );
  }
  if (status === "saving" || pending > 0) {
    return <span className="text-[var(--muted)]">Saving…</span>;
  }
  if (status === "saved") {
    return <span className="text-[var(--muted)]">Saved ✓</span>;
  }
  return null;
}

function SaveSummary({
  status,
  pending,
  onRetry,
}: {
  status: SaveStatus;
  pending: number;
  onRetry: () => void;
}) {
  if (status === "error") {
    return (
      <p className="text-sm text-[var(--danger)]">
        {pending} result{pending === 1 ? "" : "s"} couldn&apos;t be saved —
        retrying…{" "}
        <button
          type="button"
          onClick={onRetry}
          className="font-medium underline hover:no-underline"
        >
          Retry now
        </button>
      </p>
    );
  }
  if (status === "saving" || pending > 0) {
    return (
      <p className="text-sm text-[var(--muted)]">Saving your results…</p>
    );
  }
  return <p className="text-sm text-[var(--muted)]">All results saved.</p>;
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
