import Link from "next/link";
import { createCardAction } from "@/app/actions";
import { CardForm } from "@/app/cards/CardForm";

export default function NewCardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">New card</h1>
        <Link
          href="/cards"
          className="text-sm text-[var(--muted)] hover:underline"
        >
          ← Back to cards
        </Link>
      </div>
      <CardForm action={createCardAction} submitLabel="Create card" />
    </div>
  );
}
