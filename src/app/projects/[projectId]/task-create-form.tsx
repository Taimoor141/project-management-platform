"use client";

import { FormEvent, useState } from "react";

export function TaskCreateForm({ projectId }: { projectId: string }) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const response = await fetch(`/api/projects/${projectId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, priority }),
    });

    if (!response.ok) {
      setError("Unable to create task.");
      setIsSubmitting(false);
      return;
    }

    setTitle("");
    setIsSubmitting(false);
    window.location.reload();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row">
      <input
        required
        minLength={2}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="What needs to be done?"
        className="field min-w-0 flex-1"
      />
      <select
        value={priority}
        onChange={(event) => setPriority(event.target.value)}
        className="field"
      >
        <option value="LOW">Low priority</option>
        <option value="MEDIUM">Medium priority</option>
        <option value="HIGH">High priority</option>
        <option value="URGENT">Urgent</option>
      </select>
      <button
        disabled={isSubmitting}
        className="btn-primary disabled:opacity-50"
      >
        {isSubmitting ? "Adding..." : "Add task"}
      </button>
      {error ? <p className="text-sm text-red-400 sm:absolute">{error}</p> : null}
    </form>
  );
}
