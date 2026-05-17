"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import {
  createCard,
  deleteCard,
  recordReview,
  updateCard,
} from "@/lib/cards";
import type { ReviewOutcome } from "@/lib/spaced-repetition";

async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }
  return userId;
}

function parseForm(formData: FormData) {
  const front = String(formData.get("front") ?? "").trim();
  const back = String(formData.get("back") ?? "").trim();
  const tagRaw = String(formData.get("tag") ?? "").trim();
  const tag = tagRaw.length > 0 ? tagRaw : null;
  return { front, back, tag };
}

export async function createCardAction(formData: FormData) {
  const userId = await requireUserId();
  const { front, back, tag } = parseForm(formData);
  if (!front || !back) {
    throw new Error("Both front and back are required.");
  }
  await createCard({ userId, front, back, tag });
  revalidatePath("/");
  revalidatePath("/cards");
  revalidatePath("/review");
  redirect("/cards");
}

export async function updateCardAction(formData: FormData) {
  const userId = await requireUserId();
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) throw new Error("Invalid card id.");
  const { front, back, tag } = parseForm(formData);
  if (!front || !back) {
    throw new Error("Both front and back are required.");
  }
  await updateCard(userId, id, { front, back, tag });
  revalidatePath("/");
  revalidatePath("/cards");
  revalidatePath(`/cards/${id}/edit`);
  redirect("/cards");
}

export async function deleteCardAction(formData: FormData) {
  const userId = await requireUserId();
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) throw new Error("Invalid card id.");
  await deleteCard(userId, id);
  revalidatePath("/");
  revalidatePath("/cards");
  revalidatePath("/review");
}

export async function reviewCardAction(formData: FormData) {
  const userId = await requireUserId();
  const id = Number(formData.get("id"));
  const outcome = String(formData.get("outcome")) as ReviewOutcome;
  if (!Number.isFinite(id)) throw new Error("Invalid card id.");
  if (outcome !== "good" && outcome !== "again") {
    throw new Error("Invalid review outcome.");
  }
  await recordReview(userId, id, outcome);
  revalidatePath("/");
  revalidatePath("/review");
  revalidatePath("/cards");
}
