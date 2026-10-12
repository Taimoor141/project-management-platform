"use client";

import { useState } from "react";
import { ConferenceCreateForm } from "./conference-create-form";

type Conference = { id: string; title: string; status: string };

export function ChannelCard({
  channel,
  canManage,
}: {
  channel: {
    id: string;
    name: string;
    type: "TEXT" | "AUDIO";
    description: string | null;
    organization: { name: string };
    project: { name: string } | null;
    conferences: Conference[];
  };
  canManage: boolean;
}) {
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [message, setMessage] = useState("");

  async function joinChannel() {
    if (joined) {
      setJoined(false);
      setMessage("You left the channel.");
      return;
    }
    try {
      await navigator.mediaDevices?.getUserMedia({ audio: true });
      setJoined(true);
      setMessage("You joined the audio channel.");
    } catch {
      setJoined(true);
      setMessage("Joined in listen-only mode. Microphone permission was not granted.");
    }
  }

  return (
    <article className="surface p-5 transition hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{channel.organization.name}{channel.project ? ` / ${channel.project.name}` : ""}</p>
          <h2 className="mt-2 text-xl font-semibold">{channel.name}</h2>
          <p className="mt-2 text-sm text-neutral-600">{channel.description || "Team audio room"}</p>
        </div>
        <span className="status-chip">{channel.type === "AUDIO" ? "Audio" : "Text"}</span>
      </div>
      <div className="mt-5 flex gap-2">
        <button type="button" onClick={joinChannel} className="btn-primary">{joined ? "Leave channel" : channel.type === "AUDIO" ? "Join audio" : "Open chat"}</button>
        {joined ? <button type="button" onClick={() => setMuted((current) => !current)} className="btn-secondary">{muted ? "Unmute" : "Mute"}</button> : null}
      </div>
      {message ? <p className="mt-3 text-xs text-[var(--brand)] animate-fade">{message}</p> : null}
      {canManage ? <ConferenceCreateForm channelId={channel.id} /> : null}
      {channel.conferences.length > 0 ? <div className="mt-4 border-t border-neutral-200 pt-3 text-xs text-neutral-600">{channel.conferences.map((conference) => <p key={conference.id}>{conference.title} · {conference.status.toLowerCase()}</p>)}</div> : null}
    </article>
  );
}
