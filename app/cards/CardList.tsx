"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { deleteCardAction, deleteCardsAction } from "@/app/actions";

export type CardRow = {
  id: number;
  front: string;
  back: string;
  tag: string | null;
  reviewLevel: number;
  intervalLabel: string;
  isDue: boolean;
  nextLabel: string;
  nextReviewTitle: string;
};

export default function CardList({ cards }: { cards: CardRow[] }) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isPending, startTransition] = useTransition();
  const selectAllRef = useRef<HTMLInputElement>(null);

  const selectedCount = cards.filter((c) => selected.has(c.id)).length;
  const allSelected = cards.length > 0 && selectedCount === cards.length;
  const someSelected = selectedCount > 0 && !allSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(cards.map((c) => c.id)));
  }

  function deleteSelected() {
    const ids = cards.filter((c) => selected.has(c.id)).map((c) => c.id);
    if (ids.length === 0) return;
    startTransition(async () => {
      await deleteCardsAction(ids);
      setSelected(new Set());
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--card)] px-4 py-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            ref={selectAllRef}
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          {selectedCount > 0
            ? `${selectedCount} selected`
            : `Select all (${cards.length})`}
        </label>
        <button
          type="button"
          onClick={deleteSelected}
          disabled={selectedCount === 0 || isPending}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-[var(--danger)] hover:bg-[var(--danger)]/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          {isPending
            ? "Deleting…"
            : `Delete selected${selectedCount > 0 ? ` (${selectedCount})` : ""}`}
        </button>
      </div>

      <ul className="flex flex-col gap-3">
        {cards.map((card) => {
          const isSelected = selected.has(card.id);
          return (
            <li
              key={card.id}
              className={`rounded-lg border bg-[var(--card)] p-4 transition-colors ${
                isSelected
                  ? "border-[var(--accent)]"
                  : "border-[var(--border)]"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(card.id)}
                  aria-label={`Select card: ${card.front}`}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
                        card.isDue
                          ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                          : "bg-black/[.04] dark:bg-white/[.06]"
                      }`}
                    >
                      L{card.reviewLevel} · {card.intervalLabel}
                    </span>
                    {card.tag && (
                      <Link
                        href={`/cards?tag=${encodeURIComponent(card.tag)}`}
                        className="rounded-full bg-black/[.04] px-2 py-0.5 hover:bg-[var(--accent)]/10 hover:text-[var(--accent)] dark:bg-white/[.06]"
                      >
                        {card.tag}
                      </Link>
                    )}
                    <span title={card.nextReviewTitle}>{card.nextLabel}</span>
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
    </div>
  );
}
