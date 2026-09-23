"use client";

import { useActionState } from "react";
import { signInAction, type SignInState } from "@/app/actions";

const INITIAL_STATE: SignInState = {};

export function SignInForm({ next }: { next: string }) {
  const [state, formAction, isPending] = useActionState(
    signInAction,
    INITIAL_STATE
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-5"
    >
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Username</span>
        <input
          name="username"
          required
          defaultValue={state.username}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          className="rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Password</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
        />
      </label>
      {state.error && (
        <div className="text-sm text-[var(--danger)]">{state.error}</div>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="mt-1 inline-flex h-9 items-center justify-center rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-foreground)] hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
