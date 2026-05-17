import Link from "next/link";
import { notFound } from "next/navigation";
import { getCard } from "@/lib/cards";
import { updateCardAction } from "@/app/actions";
import { CardForm } from "@/app/cards/CardForm";

export default async function EditCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cardId = Number(id);
  if (!Number.isFinite(cardId)) notFound();

  const card = await getCard(cardId);
  if (!card) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Edit card</h1>
        <Link
          href="/cards"
          className="text-sm text-[var(--muted)] hover:underline"
        >
          ← Back to cards
        </Link>
      </div>
      <CardForm
        action={updateCardAction}
        submitLabel="Save changes"
        hiddenId={cardId}
        defaultValues={{
          front: card.front,
          back: card.back,
          tag: card.tag,
        }}
      />
      <div className="text-xs text-[var(--muted)]">
        Current level: L{card.reviewLevel} · Next review:{" "}
        {card.nextReviewAt.toLocaleString()}
      </div>
    </div>
  );
}
