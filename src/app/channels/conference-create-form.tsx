"use client";

import { FormEvent, useState } from "react";

export function ConferenceCreateForm({ channelId }: { channelId: string }) {
  const [title, setTitle] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/audio/conferences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channelId, title, scheduledFor: scheduledFor || null }) });
    setMessage(response.ok ? "Conference scheduled." : "Only admins can schedule conferences.");
    if (response.ok) {
      setTitle("");
      setScheduledFor("");
      window.location.reload();
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-2">
      <input required minLength={2} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Conference title" className="field w-full" />
      <div className="flex gap-2">
        <input type="datetime-local" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} className="field min-w-0 flex-1" />
        <button className="btn-primary">Schedule</button>
      </div>
      {message ? <p role="status" className="text-xs text-[var(--brand)]">{message}</p> : null}
    </form>
  );
}
