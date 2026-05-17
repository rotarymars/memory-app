"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { bulkImportAction, type BulkImportState } from "@/app/actions";
import { parseBulkInput } from "@/lib/parse-bulk";

const INITIAL: BulkImportState = { ok: false };

const PLACEHOLDER = `What does TCP stand for?

Transmission Control Protocol

What is HTTP?

HyperText Transfer Protocol`;

export function ImportForm() {
  const [state, formAction, isPending] = useActionState(
    bulkImportAction,
    INITIAL
  );
  const [text, setText] = useState("");
  const [tag, setTag] = useState("");

  const preview = useMemo(() => parseBulkInput(text), [text]);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-lg border border-[var(--border)] bg-[var(--card)] p-6"
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Cards</span>
        <textarea
          name="text"
          required
          rows={16}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PLACEHOLDER}
          className="rounded-md border border-[var(--border)] bg-transparent px-3 py-2 font-mono text-sm focus:border-[var(--accent)] focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">
          Tag for all cards{" "}
          <span className="font-normal text-[var(--muted)]">(optional)</span>
        </span>
        <input
          name="tag"
          type="text"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder="e.g. networking"
          className="rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
        />
      </label>

      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-[var(--muted)]">
          {preview.length === 0
            ? "0 cards parsed"
            : `${preview.length} card${preview.length === 1 ? "" : "s"} parsed${
                tag ? ` · tag: ${tag}` : ""
              }`}
        </div>
        <button
          type="submit"
          disabled={isPending || preview.length === 0}
          className="inline-flex h-10 items-center rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-foreground)] hover:opacity-90 disabled:opacity-50"
        >
          {isPending
            ? "Importing…"
            : preview.length === 0
              ? "Import"
              : `Import ${preview.length}`}
        </button>
      </div>

      {state.error && (
        <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/5 p-3 text-sm text-[var(--danger)]">
          {state.error}
        </div>
      )}
      {state.ok && state.created !== undefined && (
        <div className="flex items-center justify-between rounded-md border border-[var(--accent)]/40 bg-[var(--accent)]/5 p-3 text-sm">
          <span>
            Imported {state.created} card{state.created === 1 ? "" : "s"}.
          </span>
          <Link
            href="/cards"
            className="font-medium text-[var(--accent)] hover:underline"
          >
            View cards →
          </Link>
        </div>
      )}

      {preview.length > 0 && (
        <details className="rounded-md border border-[var(--border)] bg-[var(--background)] p-3 text-sm">
          <summary className="cursor-pointer font-medium">
            Preview ({preview.length})
          </summary>
          <ul className="mt-3 flex flex-col gap-2">
            {preview.slice(0, 20).map((p, i) => (
              <li
                key={i}
                className="rounded border border-[var(--border)] bg-[var(--card)] p-2"
              >
                <div className="whitespace-pre-wrap font-medium leading-6">
                  {p.front}
                </div>
                <div className="mt-1 whitespace-pre-wrap text-[var(--muted)] leading-6">
                  {p.back}
                </div>
              </li>
            ))}
            {preview.length > 20 && (
              <li className="text-xs text-[var(--muted)]">
                …and {preview.length - 20} more
              </li>
            )}
          </ul>
        </details>
      )}
    </form>
  );
}
