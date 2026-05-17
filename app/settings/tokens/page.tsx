import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { listApiTokens } from "@/lib/api-tokens";
import { CreateTokenForm } from "./CreateTokenForm";
import { deleteApiTokenAction } from "@/app/actions";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function TokensPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const tokens = await listApiTokens(userId);

  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">API tokens</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Use a token to create cards from a script. The token is only shown
          once — copy it before you leave the page.
        </p>
      </div>

      <CreateTokenForm />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
          Active tokens
        </h2>
        {tokens.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">
            No tokens yet.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {tokens.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--card)] p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {t.name}
                    <span className="font-mono text-xs text-[var(--muted)]">
                      {t.tokenPreview}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--muted)]">
                    Created {t.createdAt.toLocaleDateString()} ·{" "}
                    {t.lastUsedAt
                      ? `Last used ${t.lastUsedAt.toLocaleString()}`
                      : "Never used"}
                  </div>
                </div>
                <form action={deleteApiTokenAction}>
                  <input type="hidden" name="id" value={t.id} />
                  <button
                    type="submit"
                    className="rounded-md px-2 py-1 text-xs font-medium text-[var(--muted)] hover:bg-[var(--danger)]/10 hover:text-[var(--danger)]"
                  >
                    Revoke
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
          Usage
        </h2>
        <p className="text-sm text-[var(--muted)]">
          Send a <code className="font-mono">POST</code> request to{" "}
          <code className="font-mono">/api/cards</code> with your token as a
          Bearer header.
        </p>
        <pre className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 text-xs leading-6">
          <code>{`curl -X POST ${origin}/api/cards \\
  -H "Authorization: Bearer mem_xxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "front": "What does TCP stand for?",
    "back": "Transmission Control Protocol",
    "tag": "networking"
  }'`}</code>
        </pre>
        <p className="text-sm text-[var(--muted)]">
          Or list cards (optionally filtered by tag):
        </p>
        <pre className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 text-xs leading-6">
          <code>{`curl ${origin}/api/cards?tag=networking \\
  -H "Authorization: Bearer mem_xxxxxxxxxxxx"`}</code>
        </pre>
      </section>
    </div>
  );
}
