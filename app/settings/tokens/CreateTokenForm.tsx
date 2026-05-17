"use client";

import { useActionState, useState } from "react";
import {
  createApiTokenAction,
  type CreateApiTokenState,
} from "@/app/actions";

const INITIAL_STATE: CreateApiTokenState = { ok: false };

export function CreateTokenForm() {
  const [state, formAction, isPending] = useActionState(
    createApiTokenAction,
    INITIAL_STATE
  );
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!state.token) return;
    try {
      await navigator.clipboard.writeText(state.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        action={formAction}
        className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-5"
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Token name</span>
          <input
            name="name"
            required
            placeholder="e.g. import script, anki migration"
            className="rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
          />
        </label>
        {state.error && (
          <div className="text-sm text-[var(--danger)]">{state.error}</div>
        )}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex h-9 items-center rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-foreground)] hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "Creating…" : "Create token"}
          </button>
        </div>
      </form>

      {state.ok && state.token && (
        <div className="rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-[var(--accent)]">
                Token created — copy it now
              </div>
              <div className="mt-1 text-xs text-[var(--muted)]">
                For your safety, this is the only time you&apos;ll see this
                value.
              </div>
              <code className="mt-3 block overflow-x-auto break-all rounded-md border border-[var(--border)] bg-[var(--card)] p-2 font-mono text-xs">
                {state.token}
              </code>
            </div>
            <button
              type="button"
              onClick={copy}
              className="shrink-0 rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs font-medium hover:bg-black/[.04] dark:hover:bg-white/[.06]"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
