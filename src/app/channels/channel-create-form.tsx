"use client";

import { FormEvent, useState } from "react";

export function ChannelCreateForm() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"TEXT" | "AUDIO">("TEXT");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/audio/channels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, description, type }) });
    if (!response.ok) {
      setError("Only organization admins can create audio channels.");
      return;
    }
    window.location.reload();
  }

  return (
    <form onSubmit={submit} className="mt-5 grid gap-3 border-t border-neutral-200 pt-5 sm:grid-cols-[1fr_1.5fr_auto_auto]">
      <input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} placeholder="Channel name" className="field" />
      <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What is this channel for?" className="field" />
      <select value={type} onChange={(event) => setType(event.target.value as "TEXT" | "AUDIO")} className="field"><option value="TEXT">Text channel</option><option value="AUDIO">Audio channel</option></select>
      <button className="btn-primary">Create channel</button>
      {error ? <p role="alert" className="text-sm text-[var(--danger)] sm:col-span-3">{error}</p> : null}
    </form>
  );
}
