"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  formatInterval,
  intervalMinutesForLevel,
  type ReviewOutcome,
} from "@/lib/spaced-repetition";
import {
  orderCards,
  reorderRemaining,
  RELEARN_GAP,
  REVIEW_ORDER_LABELS,
  REVIEW_ORDERS,
  type ReviewOrder,
} from "@/lib/review-order";
import {
  answerCard,
  mergeAnswer,
  practiceCard,
  startSession,
  type HeldAnswer,
  type PendingReview,
  type SessionState,
} from "@/lib/review-session";

type ReviewCard = {
  id: number;
  front: string;
  back: string;
  tag: string | null;
  reviewLevel: number;
  frontImageUrl: string | null;
  backImageUrl: string | null;
  relearn?: boolean;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

// The state just before the last answer, so it can be undone. `held` is that
// answer's result, kept back from the save queue until the next answer or
// until the page is left — once it's handed over the undo point is dropped.
// Practice answers save nothing, so their `held` is null.
type UndoPoint = { prev: SessionState<ReviewCard>; held: HeldAnswer | null };

function toPayload(entries: Iterable<[number, PendingReview]>) {
  return Array.from(entries, ([id, p]) => ({ id, ...p }));
}

const MAX_RETRY_DELAY = 15_000;
const BASE_RETRY_DELAY = 2_000;

// A horizontal drag at least this long (px) counts as a swipe.
const SWIPE_MIN_PX = 60;

export function ReviewSession({
  initialCards,
  tag,
  practice: initialPractice = false,
  initialOrder = "random",
}: {
  initialCards: ReviewCard[];
  initialOrder?: ReviewOrder;
  tag?: string | null;
  // Practice mode never saves: answers only reorder this session's queue.
  practice?: boolean;
}) {
  const [session, setSession] = useState(() => startSession(initialCards));
  const [revealed, setRevealed] = useState(false);
  const [order, setOrder] = useState(initialOrder);
  // A review session can turn into a practice round of the cards it missed.
  const [practice, setPractice] = useState(initialPractice);
  const [round, setRound] = useState(1);
  const [zoom, setZoom] = useState<string | null>(null);
  const [fling, setFling] = useState<"left" | "right" | null>(null);

  // Background save state. The pending map is the source of truth (cardId →
  // unsaved result); `pending`/`status` mirror it for rendering only.
  const pendingRef = useRef<Map<number, PendingReview>>(new Map());
  const flushingRef = useRef(false);
  const flushRef = useRef<() => void>(() => {});
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelayRef = useRef(BASE_RETRY_DELAY);
  const [pending, setPending] = useState(0);
  const [status, setStatus] = useState<SaveStatus>("idle");

  const undoRef = useRef<UndoPoint | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  // Synchronous gate so a card is answered at most once per reveal, even on
  // keyboard autorepeat (the keydown listener closes over stale state).
  const revealedRef = useRef(false);

  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const swipedAtRef = useRef(0);
  const flingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { queue, index, completed, missed } = session;
  const current = queue[index];
  const remaining = queue.length - index;

  const reveal = useCallback(() => {
    revealedRef.current = true;
    setRevealed(true);
  }, []);

  // Hands the held-back last answer over to the save queue. After this the
  // answer can't be undone, since it may already be on its way to the server.
  // Returns whether there was anything to hand over.
  const commitHeld = useCallback((): boolean => {
    const held = undoRef.current?.held;
    if (!held) return false;
    pendingRef.current.set(
      held.id,
      mergeAnswer(pendingRef.current.get(held.id), held)
    );
    undoRef.current = null;
    setCanUndo(false);
    setPending(pendingRef.current.size);
    setStatus("saving");
    return true;
  }, []);

  // Drains the pending map to the server. Single-flight: concurrent calls
  // return early, and the in-flight call re-drains anything that piled up.
  const flush = useCallback(async () => {
    if (flushingRef.current) return;
    const batch = Array.from(pendingRef.current);
    if (batch.length === 0) return;

    flushingRef.current = true;
    setStatus("saving");

    let ok = false;
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reviews: toPayload(batch) }),
        keepalive: true,
      });
      ok = res.ok;
    } catch {
      ok = false;
    } finally {
      flushingRef.current = false;
    }

    if (ok) {
      // Clear the entries that were sent. If a card was re-answered while the
      // request was in flight, its entry was merged with the one just saved —
      // keep only the part that hasn't been saved yet.
      for (const [id, sent] of batch) {
        const current = pendingRef.current.get(id);
        if (current === sent) {
          pendingRef.current.delete(id);
        } else if (current) {
          const counts = { ...current.counts };
          for (const o of Object.keys(counts) as ReviewOutcome[]) {
            counts[o] = Math.max(0, counts[o] - sent.counts[o]);
          }
          pendingRef.current.set(id, {
            level: current.level,
            from: sent.level,
            counts,
          });
        }
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

  function showFling(dir: "left" | "right") {
    setFling(dir);
    if (flingTimerRef.current) clearTimeout(flingTimerRef.current);
    flingTimerRef.current = setTimeout(() => setFling(null), 140);
  }

  // Re-sorts the cards still to come. The card on screen stays put once its
  // answer is showing; before that it's reshuffled along with the rest. Cards
  // waiting to be relearned keep their place.
  function changeOrder(next: ReviewOrder) {
    setOrder(next);
    // Keep the choice in the URL so a reload doesn't reset it.
    const url = new URL(window.location.href);
    url.searchParams.set("order", next);
    window.history.replaceState(null, "", url);
    const from = revealedRef.current ? index + 1 : index;
    setSession((s) => ({ ...s, queue: reorderRemaining(s.queue, from, next) }));
  }

  // Practice: a miss puts the card back a few cards later, a hit drops it.
  function practiceAnswer(gotIt: boolean) {
    if (!revealedRef.current || !current) return;
    const next = practiceCard(session, gotIt);
    if (!next) return;
    revealedRef.current = false;
    undoRef.current = { prev: session, held: null };
    setCanUndo(true);
    setSession(next);
    setRevealed(false);
    showFling(gotIt ? "right" : "left");
  }

  function answer(outcome: ReviewOutcome) {
    if (!revealedRef.current || !current) return;
    const result = answerCard(session, outcome);
    if (!result) return;
    revealedRef.current = false;

    // The previous answer can't be undone any more: send it on its way. This
    // one is held back until the next answer (or until the page is left).
    const handedOver = commitHeld();
    undoRef.current = { prev: session, held: result.held };
    setCanUndo(true);
    // Last card of the session: nothing will follow to send it, so save it
    // now.
    const finished = !result.state.queue[result.state.index];
    if (finished) commitHeld();
    if (handedOver || finished) void flush();

    setSession(result.state);
    setRevealed(false);
    showFling(outcome === "again" || outcome === "down" ? "left" : "right");
  }

  // Takes back the last answer: the queue, the counters and the card's level
  // go back to just before it, and its result is never sent.
  function undo() {
    const point = undoRef.current;
    if (!point) return;
    undoRef.current = null;
    setCanUndo(false);
    revealedRef.current = false;
    setSession(point.prev);
    setRevealed(false);
  }

  // Starts an unsaved practice round of the cards missed this session.
  function practiceMissed() {
    commitHeld();
    void flush();
    const latest = new Map<number, ReviewCard>();
    for (const c of queue) latest.set(c.id, c);
    const cards = missed
      .map((id) => latest.get(id))
      .filter((c): c is ReviewCard => c !== undefined)
      .map((c) => ({ ...c, relearn: undefined }));
    undoRef.current = null;
    setCanUndo(false);
    revealedRef.current = false;
    setRevealed(false);
    setPractice(true);
    setRound((r) => r + 1);
    setSession(startSession(orderCards(cards, order)));
  }

  function swipe(dir: "left" | "right") {
    if (!revealedRef.current) {
      reveal();
      return;
    }
    if (practice) practiceAnswer(dir === "right");
    else answer(dir === "right" ? "good" : "again");
  }

  // Keyboard shortcuts: Space/Enter reveals; once revealed, 1-4 grade the card
  // (1 = two down, 2 = down, 3 = up, 4 = two up), ← = Again and → = Good. In
  // practice mode 1/← = missed and 2/→ = got it. Z undoes the last answer.
  useEffect(() => {
    const grades: Record<string, ReviewOutcome> = {
      "1": "again",
      "2": "down",
      "3": "good",
      "4": "great",
      ArrowLeft: "again",
      ArrowRight: "good",
    };
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      if (e.target instanceof HTMLTextAreaElement) return;
      if (e.target instanceof HTMLSelectElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (zoom) {
        if (e.key === "Escape") setZoom(null);
        return;
      }
      if (e.key === "z" || e.key === "Z") {
        e.preventDefault();
        undo();
      } else if (!revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        reveal();
      } else if (
        revealed &&
        practice &&
        ["1", "2", "ArrowLeft", "ArrowRight"].includes(e.key)
      ) {
        e.preventDefault();
        practiceAnswer(e.key === "2" || e.key === "ArrowRight");
      } else if (revealed && !practice && grades[e.key]) {
        e.preventDefault();
        answer(grades[e.key]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, session, practice, zoom]);

  // Best-effort flush that survives where a normal fetch would be cancelled —
  // tab hide/close, or unmount on client-side navigation. The held-back last
  // answer goes too, so leaving never loses it (it just can't be undone after).
  // The absolute-state payload is idempotent, so re-sending in-flight entries
  // is harmless.
  const beaconFlush = useCallback(() => {
    commitHeld();
    if (pendingRef.current.size === 0) return;
    const reviews = toPayload(pendingRef.current);
    const blob = new Blob([JSON.stringify({ reviews })], {
      type: "application/json",
    });
    navigator.sendBeacon?.("/api/reviews", blob);
  }, [commitHeld]);

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
      if (flingTimerRef.current) clearTimeout(flingTimerRef.current);
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

  // Results are saved unless the session started in practice mode.
  const saves = !initialPractice;

  if (!current) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <div className="text-5xl">🎉</div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {round > 1 ? "Practice round complete." : "Session complete."}
        </h1>
        <p className="text-[var(--muted)]">
          You {practice ? "practiced" : "reviewed"} {completed} card
          {completed === 1 ? "" : "s"}
          {missed.length > 0 && (
            <>
              {" "}
              · missed{" "}
              <span className="font-semibold text-[var(--danger)]">
                {missed.length}
              </span>
            </>
          )}
          .
        </p>
        {practice && (
          <p className="text-sm text-[var(--muted)]">
            Practice mode — your review schedule wasn&apos;t changed
            {round > 1 ? " by this round" : ""}.
          </p>
        )}
        {saves && (
          <SaveSummary status={status} pending={pending} onRetry={retryNow} />
        )}
        <div className="mt-2 flex w-full max-w-sm flex-col gap-2">
          {missed.length > 0 && (
            <button
              type="button"
              onClick={practiceMissed}
              className="inline-flex h-12 items-center justify-center rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/5 px-4 text-sm font-medium text-[var(--danger)] hover:bg-[var(--danger)]/10"
            >
              間違えたカードだけもう一度（練習・保存なし）· {missed.length}
            </button>
          )}
          {canUndo && (
            <button
              type="button"
              onClick={undo}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--card)] px-4 text-sm font-medium hover:bg-black/[.04] dark:hover:bg-white/[.06]"
            >
              Undo last answer <Key>Z</Key>
            </button>
          )}
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-foreground)] hover:opacity-90"
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
  const againInterval = intervalMinutesForLevel(current.reviewLevel - 2);
  const downInterval = intervalMinutesForLevel(current.reviewLevel - 1);
  const goodInterval = intervalMinutesForLevel(current.reviewLevel + 1);
  const greatInterval = intervalMinutesForLevel(current.reviewLevel + 2);
  const total = completed + remaining;

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]">
          <div className="flex flex-wrap items-center gap-2">
            {practice && (
              <span className="inline-flex items-center rounded-full bg-[var(--warning)]/10 px-2 py-0.5 font-medium text-[var(--warning)]">
                Practice · not saved
              </span>
            )}
            {tag && (
              <span className="inline-flex items-center rounded-full bg-[var(--accent)]/10 px-2 py-0.5 font-medium text-[var(--accent)]">
                {tag}
              </span>
            )}
            <span className="tabular-nums">
              {completed + 1} / {total}
            </span>
            {missed.length > 0 && (
              <span className="tabular-nums text-[var(--danger)]">
                Missed {missed.length}
              </span>
            )}
            <span className="inline-flex items-center rounded-full bg-black/[.04] px-2 py-0.5 dark:bg-white/[.06]">
              L{current.reviewLevel} · {formatInterval(currentInterval)}
            </span>
            {current.relearn && (
              <span className="inline-flex items-center rounded-full bg-[var(--danger)]/10 px-2 py-0.5 font-medium text-[var(--danger)]">
                Relearning
              </span>
            )}
            {current.tag && (
              <span className="rounded-full bg-black/[.04] px-2 py-0.5 dark:bg-white/[.06]">
                {current.tag}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <select
              value={order}
              onChange={(e) => {
                changeOrder(e.target.value as ReviewOrder);
                // Hand focus back so Space/1-4 shortcuts keep working.
                e.target.blur();
              }}
              aria-label="Card order"
              title="Card order (cards on the same level are shuffled)"
              className="rounded-md border border-[var(--border)] bg-[var(--card)] px-1.5 py-0.5 text-xs text-[var(--foreground)]"
            >
              {REVIEW_ORDERS.map((o) => (
                <option key={o} value={o}>
                  {REVIEW_ORDER_LABELS[o]}
                </option>
              ))}
            </select>
            {(saves || pending > 0) && (
              <SaveIndicator
                status={status}
                pending={pending}
                onRetry={retryNow}
              />
            )}
            <Link href="/" className="hover:underline">
              End session
            </Link>
          </div>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-black/[.06] dark:bg-white/[.08]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={completed}
        >
          <div
            className="h-full rounded-full bg-[var(--success)] transition-[width] duration-200"
            style={{ width: `${(100 * completed) / total}%` }}
          />
        </div>
      </div>

      <div
        className={`relative select-none rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm transition-[transform,box-shadow] duration-150 sm:p-10 ${
          revealed ? "" : "cursor-pointer hover:shadow-md"
        } ${
          fling === "left"
            ? "-translate-x-3 -rotate-1"
            : fling === "right"
              ? "translate-x-3 rotate-1"
              : ""
        }`}
        onClick={() => {
          // A swipe also fires a click; don't let it flip the next card.
          if (Date.now() - swipedAtRef.current < 450) return;
          // Don't treat a drag-to-select as a reveal click.
          if (window.getSelection()?.toString()) return;
          if (!revealed) reveal();
        }}
        onTouchStart={(e) => {
          const t = e.touches[0];
          touchRef.current = t ? { x: t.clientX, y: t.clientY } : null;
        }}
        onTouchEnd={(e) => {
          const start = touchRef.current;
          touchRef.current = null;
          const t = e.changedTouches[0];
          if (!start || !t) return;
          const dx = t.clientX - start.x;
          const dy = t.clientY - start.y;
          if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < 1.5 * Math.abs(dy))
            return;
          swipedAtRef.current = Date.now();
          swipe(dx > 0 ? "right" : "left");
        }}
      >
        <div className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
          Front
        </div>
        <div className="mt-2 whitespace-pre-wrap text-xl font-medium leading-8">
          {current.front}
        </div>
        {current.frontImageUrl && (
          <CardImage
            src={current.frontImageUrl}
            alt="Front image"
            onZoom={setZoom}
          />
        )}

        {revealed ? (
          <div className="mt-6 border-t border-[var(--border)] pt-5 sm:mt-8 sm:pt-6">
            <div className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
              Back
            </div>
            <div className="mt-2 whitespace-pre-wrap text-lg leading-7">
              {current.back}
            </div>
            {current.backImageUrl && (
              <CardImage
                src={current.backImageUrl}
                alt="Back image"
                onZoom={setZoom}
              />
            )}
          </div>
        ) : (
          <div className="mt-8 text-center text-sm text-[var(--muted)]">
            Tap to reveal
            <span className="hidden sm:inline">
              {" "}
              · or press <Key>Space</Key>
            </span>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 -mx-6 flex flex-col gap-2 bg-[var(--background)]/95 px-6 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        {revealed && practice ? (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => practiceAnswer(false)}
              className="flex flex-col items-center rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--danger)]/40 hover:bg-[var(--danger)]/5"
            >
              <span className="text-sm font-semibold text-[var(--danger)]">
                Missed
              </span>
              <span className="mt-1 text-xs text-[var(--muted)]">
                Back in {RELEARN_GAP} cards
              </span>
              <span className="mt-2 hidden sm:block">
                <Key>1 · ←</Key>
              </span>
            </button>
            <button
              type="button"
              onClick={() => practiceAnswer(true)}
              className="flex flex-col items-center rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--success)]/40 hover:bg-[var(--success)]/5"
            >
              <span className="text-sm font-semibold text-[var(--success)]">
                Got it
              </span>
              <span className="mt-1 text-xs text-[var(--muted)]">
                Next card
              </span>
              <span className="mt-2 hidden sm:block">
                <Key>2 · →</Key>
              </span>
            </button>
          </div>
        ) : revealed ? (
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
                Down ×2 · {formatInterval(againInterval)}
              </span>
              <span className="mt-2 hidden sm:block">
                <Key>1 · ←</Key>
              </span>
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
              <span className="mt-2 hidden sm:block">
                <Key>2</Key>
              </span>
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
              <span className="mt-2 hidden sm:block">
                <Key>3 · →</Key>
              </span>
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
              <span className="mt-2 hidden sm:block">
                <Key>4</Key>
              </span>
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
        <div className="flex items-center justify-between text-xs text-[var(--muted)]">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 font-medium hover:bg-black/[.04] disabled:opacity-40 disabled:hover:bg-transparent dark:hover:bg-white/[.06]"
          >
            ↶ Undo
            <span className="hidden sm:inline">
              <Key>Z</Key>
            </span>
          </button>
          <span className="sm:hidden">Swipe ← Again · Good →</span>
          <span className="hidden sm:inline">
            Missed cards come back {RELEARN_GAP} cards later
          </span>
        </div>
      </div>

      {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}

function CardImage({
  src,
  alt,
  onZoom,
}: {
  src: string;
  alt: string;
  onZoom: (src: string) => void;
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-md border border-[var(--border)] bg-black/[.02] dark:bg-white/[.03]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        title="Tap to enlarge"
        className="max-h-96 w-auto max-w-full cursor-zoom-in"
        onClick={(e) => {
          // Enlarge instead of flipping the card.
          e.stopPropagation();
          onZoom(src);
        }}
      />
    </div>
  );
}

// Full-screen image viewer. Tap the image to toggle between fit-to-screen and
// full size (scroll to pan); tap outside, the close button or Esc to close.
function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  const [big, setBig] = useState(false);
  return (
    <div
      className={`fixed inset-0 z-50 overflow-auto bg-black/90 ${
        big ? "block" : "flex items-center justify-center"
      }`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Enlarged image"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Enlarged"
        className={
          big
            ? "m-auto block max-w-none cursor-zoom-out bg-white"
            : "block max-h-screen max-w-full cursor-zoom-in bg-white object-contain"
        }
        onClick={(e) => {
          e.stopPropagation();
          setBig((b) => !b);
        }}
      />
      <button
        type="button"
        onClick={onClose}
        className="fixed right-3 top-[calc(0.75rem+env(safe-area-inset-top))] rounded-md bg-white/90 px-3 py-1.5 text-sm font-medium text-black"
      >
        Close
      </button>
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
