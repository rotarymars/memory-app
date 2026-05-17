import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ImportForm } from "./ImportForm";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Bulk import</h1>
        <Link
          href="/cards"
          className="text-sm text-[var(--muted)] hover:underline"
        >
          ← Back to cards
        </Link>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 text-sm leading-6">
        <p className="font-medium">Format</p>
        <ul className="mt-2 list-disc pl-5 text-[var(--muted)]">
          <li>
            Each front is followed by a blank line, then its back, then
            another blank line.
          </li>
          <li>Fronts and backs can span multiple lines.</li>
          <li>An optional tag below is applied to every card in the batch.</li>
        </ul>
      </div>

      <ImportForm />
    </div>
  );
}
