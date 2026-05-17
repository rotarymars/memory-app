type CardFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  hiddenId?: number;
  defaultValues?: {
    front?: string;
    back?: string;
    tag?: string | null;
  };
};

export function CardForm({
  action,
  submitLabel,
  hiddenId,
  defaultValues,
}: CardFormProps) {
  return (
    <form
      action={action}
      className="flex flex-col gap-4 rounded-lg border border-[var(--border)] bg-[var(--card)] p-6"
    >
      {hiddenId !== undefined && (
        <input type="hidden" name="id" value={hiddenId} />
      )}
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Front</span>
        <textarea
          name="front"
          required
          rows={3}
          defaultValue={defaultValues?.front ?? ""}
          placeholder="Question or prompt"
          className="rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Back</span>
        <textarea
          name="back"
          required
          rows={4}
          defaultValue={defaultValues?.back ?? ""}
          placeholder="Answer or content to memorize"
          className="rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
        />
      </label>
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
          className="inline-flex h-10 items-center rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-foreground)] hover:opacity-90"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
