import { loginAction } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 py-20">
      <div className="flex flex-col items-center gap-3 text-center">
        <span
          className="inline-block h-10 w-10 rounded-lg"
          style={{
            background: "linear-gradient(135deg, var(--accent), #a855f7)",
          }}
        />
        <h1 className="text-2xl font-semibold tracking-tight">Memory</h1>
        <p className="text-sm text-[var(--muted)]">
          Enter the password to continue.
        </p>
      </div>
      <form
        action={loginAction}
        className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-6"
      >
        {next && <input type="hidden" name="next" value={next} />}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Password</span>
          <input
            type="password"
            name="password"
            required
            autoFocus
            autoComplete="current-password"
            className="rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
          />
        </label>
        {error && (
          <div className="text-sm text-[var(--danger)]">
            Incorrect password. Try again.
          </div>
        )}
        <button
          type="submit"
          className="mt-2 inline-flex h-10 items-center justify-center rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-foreground)] hover:opacity-90"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
