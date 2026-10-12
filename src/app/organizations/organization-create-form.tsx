"use client";

import { FormEvent, useState } from "react";

export function OrganizationCreateForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const response = await fetch("/api/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug }),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      setError(result?.error === "SLUG_TAKEN" ? "That slug is already in use." : "Unable to create organization.");
      setIsSubmitting(false);
      return;
    }

    window.location.reload();
  }

  return (
    <section className="surface p-5">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="btn-primary"
      >
        {open ? "Close" : "New organization"}
      </button>

      {open ? (
        <form onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-3">
          <input
            required
            minLength={2}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Organization name"
            className="field"
          />
          <input
            required
            minLength={2}
            pattern="[a-z0-9-]+"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder="organization-slug"
            className="field"
          />
          <button
            disabled={isSubmitting}
            className="btn-secondary disabled:opacity-50"
          >
            {isSubmitting ? "Creating..." : "Create"}
          </button>
          {error ? <p role="alert" className="text-sm text-[var(--danger)] sm:col-span-3">{error}</p> : null}
        </form>
      ) : null}
    </section>
  );
}
