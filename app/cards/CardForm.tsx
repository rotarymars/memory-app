"use client";

import { useState } from "react";
import { upload } from "@vercel/blob/client";

const ACCEPT = "image/svg+xml,image/png,image/jpeg,image/heic,image/heif";

type CardFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  hiddenId?: number;
  defaultValues?: {
    front?: string;
    back?: string;
    tag?: string | null;
    frontImageUrl?: string | null;
    backImageUrl?: string | null;
  };
};

type Side = "front" | "back";

export function CardForm({
  action,
  submitLabel,
  hiddenId,
  defaultValues,
}: CardFormProps) {
  const [frontImageUrl, setFrontImageUrl] = useState<string | null>(
    defaultValues?.frontImageUrl ?? null
  );
  const [backImageUrl, setBackImageUrl] = useState<string | null>(
    defaultValues?.backImageUrl ?? null
  );
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState<Record<Side, boolean>>({
    front: false,
    back: false,
  });
  const [error, setError] = useState<Record<Side, string | null>>({
    front: null,
    back: null,
  });

  const isUploading = uploading.front || uploading.back;

  async function handleFile(side: Side, file: File) {
    setError((e) => ({ ...e, [side]: null }));
    const localUrl = URL.createObjectURL(file);
    if (side === "front") setFrontPreview(localUrl);
    else setBackPreview(localUrl);
    setUploading((u) => ({ ...u, [side]: true }));
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
      });
      if (side === "front") setFrontImageUrl(blob.url);
      else setBackImageUrl(blob.url);
    } catch (err) {
      setError((e) => ({
        ...e,
        [side]: err instanceof Error ? err.message : "Upload failed.",
      }));
      if (side === "front") setFrontPreview(null);
      else setBackPreview(null);
    } finally {
      setUploading((u) => ({ ...u, [side]: false }));
    }
  }

  function removeImage(side: Side) {
    if (side === "front") {
      setFrontImageUrl(null);
      setFrontPreview(null);
    } else {
      setBackImageUrl(null);
      setBackPreview(null);
    }
    setError((e) => ({ ...e, [side]: null }));
  }

  return (
    <form
      action={action}
      className="flex flex-col gap-4 rounded-lg border border-[var(--border)] bg-[var(--card)] p-6"
    >
      {hiddenId !== undefined && (
        <input type="hidden" name="id" value={hiddenId} />
      )}
      <input
        type="hidden"
        name="frontImageUrl"
        value={frontImageUrl ?? ""}
      />
      <input type="hidden" name="backImageUrl" value={backImageUrl ?? ""} />

      <FieldGroup
        label="Front"
        name="front"
        rows={3}
        defaultValue={defaultValues?.front ?? ""}
        placeholder="Question or prompt"
        imageUrl={frontImageUrl}
        preview={frontPreview}
        uploading={uploading.front}
        error={error.front}
        onFile={(f) => handleFile("front", f)}
        onRemove={() => removeImage("front")}
      />

      <FieldGroup
        label="Back"
        name="back"
        rows={4}
        defaultValue={defaultValues?.back ?? ""}
        placeholder="Answer or content to memorize"
        imageUrl={backImageUrl}
        preview={backPreview}
        uploading={uploading.back}
        error={error.back}
        onFile={(f) => handleFile("back", f)}
        onRemove={() => removeImage("back")}
      />

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">
          Tag <span className="text-[var(--muted)] font-normal">(optional)</span>
        </span>
        <input
          name="tag"
          type="text"
          defaultValue={defaultValues?.tag ?? ""}
          placeholder="e.g. spanish, history, react"
          className="rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
        />
      </label>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isUploading}
          className="inline-flex h-10 items-center rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-foreground)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isUploading ? "Uploading image…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

function FieldGroup({
  label,
  name,
  rows,
  defaultValue,
  placeholder,
  imageUrl,
  preview,
  uploading,
  error,
  onFile,
  onRemove,
}: {
  label: string;
  name: string;
  rows: number;
  defaultValue: string;
  placeholder: string;
  imageUrl: string | null;
  preview: string | null;
  uploading: boolean;
  error: string | null;
  onFile: (file: File) => void;
  onRemove: () => void;
}) {
  const shownImage = preview ?? imageUrl;
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{label}</span>
        <textarea
          name={name}
          required
          rows={rows}
          defaultValue={defaultValue}
          placeholder={placeholder}
          className="rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex h-8 cursor-pointer items-center rounded-md border border-[var(--border)] bg-transparent px-3 text-xs font-medium hover:bg-black/[.04] dark:hover:bg-white/[.06]">
          {shownImage ? "Replace image" : "Add image"}
          <input
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = "";
            }}
          />
        </label>
        {shownImage && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md px-2 py-1 text-xs font-medium text-[var(--muted)] hover:bg-[var(--danger)]/10 hover:text-[var(--danger)]"
          >
            Remove image
          </button>
        )}
        {uploading && (
          <span className="text-xs text-[var(--muted)]">Uploading…</span>
        )}
        <span className="text-xs text-[var(--muted)]">
          SVG, PNG, JPEG, or HEIC
        </span>
      </div>
      {error && (
        <p className="text-xs text-[var(--danger)]">{error}</p>
      )}
      {shownImage && (
        <div className="overflow-hidden rounded-md border border-[var(--border)] bg-black/[.02] dark:bg-white/[.03]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={shownImage}
            alt={`${label} image preview`}
            className="max-h-64 w-auto"
          />
        </div>
      )}
    </div>
  );
}
