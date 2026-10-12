"use client";

import { useState } from "react";

export function ApprovalActions({ type, id }: { type: "project" | "task"; id: string }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function decide(decision: "APPROVED" | "REJECTED", permanent = false) {
    setIsSubmitting(true);
    await fetch(type === "project" ? `/api/projects/${id}/approval` : `/api/tasks/${id}/approval`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, permanent }),
    });
    window.location.reload();
  }

  return (
    <div className="flex shrink-0 gap-2">
      <button
        type="button"
        disabled={isSubmitting}
        onClick={() => decide("APPROVED")}
        className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--brand)] hover:bg-[var(--surface-muted)] disabled:opacity-50"
      >
        Approve
      </button>
      <button
        type="button"
        disabled={isSubmitting}
        onClick={() => decide("REJECTED")}
        className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--danger)] hover:bg-red-50 disabled:opacity-50"
      >
        Reject
      </button>
      <button
        type="button"
        disabled={isSubmitting}
        onClick={() => decide("REJECTED", true)}
        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-[var(--danger)] hover:bg-red-50 disabled:opacity-50"
      >
        Reject permanently
      </button>
    </div>
  );
}
