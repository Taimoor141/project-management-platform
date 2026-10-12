"use client";

import { useEffect, useRef, useState } from "react";

type Channel = { id: string; name: string; type: "TEXT" | "AUDIO"; organization: { name: string }; project: { name: string } | null; conferences: { id: string; title: string; status: string }[] };
type Message = { id: string; body: string; createdAt: string; author: { name: string } };
type OnlineMember = { user: { id: string; name: string; presenceStatus: "ONLINE" | "AWAY" }; role: string; organization: { id: string; name: string } };
type VoiceParticipant = { id: string; name: string };
type VoiceSignal = { senderId: string; type: "OFFER" | "ANSWER" | "ICE"; payload: RTCSessionDescriptionInit | RTCIceCandidateInit };

export function AudioRail({ role }: { role?: string | null }) {
  const [open, setOpen] = useState(false);
  const [textExpanded, setTextExpanded] = useState(true);
  const [voiceExpanded, setVoiceExpanded] = useState(true);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [onlineMembers, setOnlineMembers] = useState<OnlineMember[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelType, setNewChannelType] = useState<"TEXT" | "AUDIO">("TEXT");
  const [showCreator, setShowCreator] = useState(false);
  const [conferenceBusy, setConferenceBusy] = useState(false);
  const [voiceJoined, setVoiceJoined] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [voiceParticipants, setVoiceParticipants] = useState<VoiceParticipant[]>([]);
  const peerConnections = useRef(new Map<string, RTCPeerConnection>());
  const remoteAudio = useRef(new Map<string, HTMLAudioElement>());
  const localStream = useRef<MediaStream | null>(null);
  const canManage = role === "OWNER" || role === "ADMIN";
  const activeConference = selectedChannel?.type === "AUDIO" ? selectedChannel.conferences.find((conference) => conference.status === "LIVE" || conference.status === "SCHEDULED") ?? null : null;

  async function loadChannels(): Promise<Channel[]> {
    const response = await fetch("/api/audio/channels", { cache: "no-store" });
    if (!response.ok) return [];
    const result: Channel[] = (await response.json()).channels ?? [];
    setChannels(result);
    return result;
  }

  useEffect(() => {
    void loadChannels();
    async function loadPresence() {
      const response = await fetch("/api/presence", { cache: "no-store" });
      if (response.ok) {
        const result = await response.json();
        setCurrentUserId(result.currentUserId ?? "");
        setOnlineMembers(result.members ?? []);
      }
    }
    void loadPresence();
    const interval = window.setInterval(loadPresence, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedChannel) return;
    const channelId = selectedChannel.id;
    async function loadMessages() {
      const response = await fetch(`/api/audio/channels/${channelId}/messages`, { cache: "no-store" });
      if (response.ok) setMessages((await response.json()).messages ?? []);
    }
    void loadMessages();
    const interval = window.setInterval(loadMessages, 5000);
    return () => window.clearInterval(interval);
  }, [selectedChannel]);

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedChannel || !draft.trim()) return;
    const response = await fetch(`/api/audio/channels/${selectedChannel.id}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: draft }) });
    if (response.ok) {
      const result = await response.json();
      setMessages((current) => [...current, result.message]);
      setDraft("");
    }
  }

  async function createChannel(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newChannelName.trim()) return;
    const response = await fetch("/api/audio/channels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newChannelName, type: newChannelType }) });
    if (response.ok) {
      setNewChannelName("");
      setShowCreator(false);
      await loadChannels();
    }
  }

  async function toggleConference(nextStatus: "LIVE" | "ENDED") {
    if (!selectedChannel || selectedChannel.type !== "AUDIO") return;
    setConferenceBusy(true);

    const response = await fetch("/api/audio/conferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channelId: selectedChannel.id,
        title: `${selectedChannel.name} conference`,
        status: nextStatus,
        scheduledFor: null,
      }),
    });

    setConferenceBusy(false);
    if (response.ok) {
      const refreshedChannels = await loadChannels();
      const nextSelected = refreshedChannels.find((channel) => channel.id === selectedChannel.id) ?? null;
      setSelectedChannel(nextSelected);
    }
  }

  async function joinVoice() {
    if (!selectedChannel || !activeConference || activeConference.status !== "LIVE") return;
    setVoiceBusy(true);
    setVoiceError("");
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const response = await fetch(`/api/audio/channels/${selectedChannel.id}/voice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join" }),
      });
      if (!response.ok) throw new Error(response.status === 409 ? "The conference has ended." : "Could not join this voice channel.");
      const result = await response.json();
      localStream.current = stream;
      setCurrentUserId(result.userId);
      setVoiceParticipants(result.participants ?? []);
      setVoiceJoined(true);
    } catch (error) {
      for (const track of stream?.getTracks() ?? []) track.stop();
      setVoiceError(error instanceof Error && error.name === "NotAllowedError" ? "Allow microphone access to join voice." : error instanceof Error ? error.message : "Could not access your microphone.");
    } finally {
      setVoiceBusy(false);
    }
  }

  function leaveVoice() {
    setVoiceJoined(false);
    setVoiceMuted(false);
    setVoiceParticipants([]);
    setVoiceError("");
  }

  useEffect(() => {
    if (!voiceJoined || !selectedChannel || !currentUserId || activeConference?.status !== "LIVE") return;
    const channelId = selectedChannel.id;
    const endpoint = `/api/audio/channels/${channelId}/voice`;
    const pendingCandidates = new Map<string, RTCIceCandidateInit[]>();
    const offeredPeers = new Set<string>();
    let stopped = false;
    let timeout: number | undefined;

    async function signal(recipientId: string, type: VoiceSignal["type"], payload: RTCSessionDescriptionInit | RTCIceCandidateInit) {
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "signal", signal: { recipientId, type, payload } }),
      });
    }

    function getPeer(participantId: string) {
      const existing = peerConnections.current.get(participantId);
      if (existing) return existing;
      const connection = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      for (const track of localStream.current?.getTracks() ?? []) connection.addTrack(track, localStream.current!);
      connection.onicecandidate = (event) => {
        if (event.candidate) void signal(participantId, "ICE", event.candidate.toJSON());
      };
      connection.ontrack = (event) => {
        const audio = remoteAudio.current.get(participantId) ?? new Audio();
        audio.autoplay = true;
        audio.srcObject = event.streams[0];
        remoteAudio.current.set(participantId, audio);
        void audio.play().catch(() => setVoiceError("Your browser blocked remote audio. Interact with the page and try again."));
      };
      peerConnections.current.set(participantId, connection);
      return connection;
    }

    async function handleSignal(incoming: VoiceSignal) {
      const connection = getPeer(incoming.senderId);
      if (incoming.type === "OFFER") {
        await connection.setRemoteDescription(incoming.payload as RTCSessionDescriptionInit);
        for (const candidate of pendingCandidates.get(incoming.senderId) ?? []) await connection.addIceCandidate(candidate);
        pendingCandidates.delete(incoming.senderId);
        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);
        await signal(incoming.senderId, "ANSWER", answer);
      } else if (incoming.type === "ANSWER") {
        await connection.setRemoteDescription(incoming.payload as RTCSessionDescriptionInit);
        for (const candidate of pendingCandidates.get(incoming.senderId) ?? []) await connection.addIceCandidate(candidate);
        pendingCandidates.delete(incoming.senderId);
      } else {
        const candidate = incoming.payload as RTCIceCandidateInit;
        if (connection.remoteDescription) await connection.addIceCandidate(candidate);
        else pendingCandidates.set(incoming.senderId, [...(pendingCandidates.get(incoming.senderId) ?? []), candidate]);
      }
    }

    async function poll() {
      try {
        const response = await fetch(endpoint, { cache: "no-store" });
        if (!response.ok) {
          if (response.status === 409) setVoiceError("The conference has ended.");
          setVoiceJoined(false);
          return;
        }
        const result = await response.json();
        if (stopped) return;
        const participants: VoiceParticipant[] = result.participants ?? [];
        setVoiceParticipants(participants);
        const participantIds = new Set(participants.map(({ id }) => id).filter((id) => id !== currentUserId));
        for (const [participantId, connection] of peerConnections.current) {
          if (!participantIds.has(participantId)) {
            connection.close();
            peerConnections.current.delete(participantId);
            remoteAudio.current.get(participantId)?.remove();
            remoteAudio.current.delete(participantId);
            offeredPeers.delete(participantId);
          }
        }
        for (const participantId of participantIds) {
          const connection = getPeer(participantId);
          if (currentUserId < participantId && !offeredPeers.has(participantId)) {
            offeredPeers.add(participantId);
            const offer = await connection.createOffer();
            await connection.setLocalDescription(offer);
            await signal(participantId, "OFFER", offer);
          }
        }
        for (const incoming of result.signals as VoiceSignal[]) {
          await handleSignal(incoming);
        }
      } catch {
        setVoiceError("Voice connection interrupted. Trying again...");
      }
      if (!stopped) timeout = window.setTimeout(poll, 1200);
    }

    void poll();
    return () => {
      stopped = true;
      if (timeout) window.clearTimeout(timeout);
      for (const connection of peerConnections.current.values()) connection.close();
      peerConnections.current.clear();
      for (const audio of remoteAudio.current.values()) {
        audio.pause();
        audio.srcObject = null;
      }
      remoteAudio.current.clear();
      for (const track of localStream.current?.getTracks() ?? []) track.stop();
      localStream.current = null;
      void fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "leave" }) });
    };
  }, [voiceJoined, selectedChannel?.id, currentUserId, activeConference?.status]);

  useEffect(() => {
    for (const track of localStream.current?.getAudioTracks() ?? []) track.enabled = !voiceMuted;
  }, [voiceMuted]);

  const textChannels = channels.filter((channel) => channel.type === "TEXT");
  const voiceChannels = channels.filter((channel) => channel.type === "AUDIO");
  const otherOnlineMembers = onlineMembers.filter((member) => member.user.id !== currentUserId);

  function getInitials(name: string) {
    const initials = name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");

    return initials || "?";
  }

  return (
    <>
      <button type="button" aria-label="Open team messages" aria-expanded={open} onClick={() => setOpen((current) => !current)} className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${open ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--brand)] hover:border-[var(--brand)] hover:bg-[var(--brand)] hover:text-white"}`}>
        <span aria-hidden="true" className="message-mark" />
      </button>
      {open ? (
        <>
          <button type="button" aria-label="Close team messages" onClick={() => setOpen(false)} className="fixed inset-0 z-40 cursor-default bg-black/20 backdrop-blur-sm" />
          <aside className="fixed bottom-0 left-0 top-0 z-50 flex w-[min(92vw,34rem)] max-w-full border-r border-[#294238] bg-[#12231c] text-white shadow-2xl animate-slide-in">
            <div className="w-20 shrink-0 overflow-y-auto border-r border-[#294238] bg-[#0b1913] p-3">
              <div className="mb-4 flex items-center justify-center">
                <span className="text-[10px] font-medium uppercase tracking-[0.24em] text-neutral-500">Online</span>
              </div>

              <div className="space-y-3">
                {otherOnlineMembers.length === 0 ? <p className="text-center text-[11px] leading-5 text-neutral-600">No teammates online.</p> : null}
                {otherOnlineMembers.map((member) => (
                  <button
                    key={`${member.organization.id}-${member.user.id}`}
                    type="button"
                    title={member.user.name}
                    aria-label={member.user.name}
                    className="group relative flex h-12 w-12 items-center justify-center rounded-full border border-[#3b5a4b] bg-[#1e3a2c] text-sm font-semibold text-white shadow-sm transition hover:border-[#d8e66d] hover:text-[#e8f3ae]"
                  >
                    {getInitials(member.user.name)}
                    <span className={`absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0b1913] ${member.user.presenceStatus === "AWAY" ? "bg-amber-400" : "bg-emerald-400"}`} />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col bg-[#14271f] p-4">
              <div className="flex items-center justify-between border-b border-[#294238] pb-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#d8e66d]">Workspace</p>
                  <h2 className="mt-2 text-xl font-semibold">Channels</h2>
                </div>
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => {
                      setNewChannelType("TEXT");
                      setShowCreator(true);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#3b5a4b] bg-[#1a3025] text-lg text-[#d8e66d] transition hover:border-[#d8e66d]"
                    aria-label="Create channel"
                    title="Create channel"
                  >
                    +
                  </button>
                ) : null}
              </div>

              {showCreator ? (
                <form onSubmit={createChannel} className="mt-4 rounded-xl border border-[#294238] bg-[#0f2018] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#d8e66d]">New {newChannelType === "TEXT" ? "text channel" : "voice channel"}</p>
                  <input autoFocus required minLength={2} value={newChannelName} onChange={(event) => setNewChannelName(event.target.value)} placeholder="Channel name" className="mt-3 w-full rounded-lg border border-[#3b5a4b] bg-[#0b1913] px-3 py-2 text-sm text-white outline-none focus:border-[#d8e66d]" />
                  <div className="mt-3 flex gap-2">
                    <button type="submit" className="rounded-lg bg-[#d8e66d] px-3 py-2 text-xs font-semibold text-[#17251c] hover:bg-[#e5ef9b]">Create</button>
                    <button type="button" onClick={() => setShowCreator(false)} className="rounded-lg border border-[#3b5a4b] px-3 py-2 text-xs text-neutral-300 hover:bg-[#20392b]">Cancel</button>
                  </div>
                </form>
              ) : null}

              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-[#294238] bg-[#0f2018] p-2">
                  <div className="flex items-center justify-between">
                    <button type="button" onClick={() => setTextExpanded((current) => !current)} className="flex flex-1 items-center gap-2 px-2 py-1 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400 hover:text-[#d8e66d]">
                      <span className="text-[#d8e66d]">#</span>
                      <span>Text channels</span>
                    </button>
                    {canManage ? (
                      <button type="button" onClick={() => { setNewChannelType("TEXT"); setShowCreator(true); }} className="flex h-7 w-7 items-center justify-center rounded-md border border-[#3b5a4b] text-lg text-neutral-300 hover:border-[#d8e66d] hover:text-[#d8e66d]" aria-label="Add text channel" title="Add text channel">+</button>
                    ) : null}
                  </div>

                  {textExpanded ? (
                    <div className="mt-2 space-y-1">
                      {textChannels.length === 0 ? <p className="px-2 py-2 text-xs text-neutral-600">No text channels yet.</p> : null}
                      {textChannels.map((channel) => (
                        <button
                          key={channel.id}
                          type="button"
                          onClick={() => setSelectedChannel(channel)}
                          className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition ${selectedChannel?.id === channel.id ? "bg-[#d8e66d] font-semibold text-[#17251c]" : "text-neutral-300 hover:bg-[#20392b] hover:text-white"}`}
                        >
                          <span className="text-[#d8e66d]">#</span>
                          <span className="truncate">{channel.name}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-xl border border-[#294238] bg-[#0f2018] p-2">
                  <div className="flex items-center justify-between">
                    <button type="button" onClick={() => setVoiceExpanded((current) => !current)} className="flex flex-1 items-center gap-2 px-2 py-1 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400 hover:text-[#d8e66d]">
                      <span className="text-[#d8e66d]">◉</span>
                      <span>Voice channels</span>
                    </button>
                    {canManage ? (
                      <button type="button" onClick={() => { setNewChannelType("AUDIO"); setShowCreator(true); }} className="flex h-7 w-7 items-center justify-center rounded-md border border-[#3b5a4b] text-lg text-neutral-300 hover:border-[#d8e66d] hover:text-[#d8e66d]" aria-label="Add voice channel" title="Add voice channel">+</button>
                    ) : null}
                  </div>

                  {voiceExpanded ? (
                    <div className="mt-2 space-y-1">
                      {voiceChannels.length === 0 ? <p className="px-2 py-2 text-xs text-neutral-600">No voice channels yet.</p> : null}
                      {voiceChannels.map((channel) => (
                        <button
                          key={channel.id}
                          type="button"
                          onClick={() => setSelectedChannel(channel)}
                          className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition ${selectedChannel?.id === channel.id ? "bg-[#d8e66d] font-semibold text-[#17251c]" : "text-neutral-300 hover:bg-[#20392b] hover:text-white"}`}
                        >
                          <span className="text-[#d8e66d]">◉</span>
                          <span className="truncate">{channel.name}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 flex min-h-0 flex-1 flex-col rounded-xl border border-[#294238] bg-[#0f2018] p-3">
                {!selectedChannel ? (
                  <div className="flex flex-1 flex-col items-center justify-center text-center">
                    <span className="message-mark mb-4 text-2xl text-[#d8e66d]" />
                    <p className="text-sm text-neutral-300">Select a channel to start chatting.</p>
                  </div>
                ) : (
                  <>
                    <div className="mb-3 border-b border-[#294238] pb-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#d8e66d]">{selectedChannel.type === "TEXT" ? "Text" : "Voice"}</p>
                      <h3 className="mt-2 text-lg font-semibold">{selectedChannel.name}</h3>
                    </div>

                    {selectedChannel.type === "AUDIO" ? (
                      <div className="mb-4 rounded-xl border border-[#47634f] bg-[#193427] p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#d8e66d]">Conference</p>
                            <p className="mt-1 text-sm font-medium text-white">{activeConference ? activeConference.title : "No live conference yet"}</p>
                          </div>
                          {canManage ? (
                            <button
                              type="button"
                              disabled={conferenceBusy}
                              onClick={() => toggleConference(activeConference ? "ENDED" : "LIVE")}
                              className="rounded-lg bg-[#d8e66d] px-3 py-2 text-xs font-semibold text-[#17251c] hover:bg-[#e5ef9b] disabled:opacity-50"
                            >
                              {conferenceBusy ? "Working..." : activeConference ? "End conference" : "Start conference"}
                            </button>
                          ) : null}
                        </div>
                        {activeConference?.status === "LIVE" ? (
                          <div className="mt-3 border-t border-[#47634f] pt-3">
                            {!voiceJoined ? (
                              <button type="button" disabled={voiceBusy} onClick={() => void joinVoice()} className="rounded-lg border border-[#718746] px-3 py-2 text-xs font-semibold text-[#e8f3ae] hover:bg-[#244330] disabled:opacity-50">
                                {voiceBusy ? "Connecting..." : "Join voice"}
                              </button>
                            ) : (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs text-emerald-300">Connected · {voiceParticipants.length} {voiceParticipants.length === 1 ? "person" : "people"}</span>
                                <button type="button" onClick={() => setVoiceMuted((muted) => !muted)} className="rounded-lg border border-[#3b5a4b] px-3 py-2 text-xs text-neutral-200 hover:bg-[#20392b]">
                                  {voiceMuted ? "Unmute" : "Mute"}
                                </button>
                                <button type="button" onClick={leaveVoice} className="rounded-lg border border-[#3b5a4b] px-3 py-2 text-xs text-neutral-200 hover:bg-[#20392b]">Leave voice</button>
                              </div>
                            )}
                            {voiceError ? <p role="status" className="mt-2 text-xs text-amber-300">{voiceError}</p> : null}
                            {voiceJoined && voiceParticipants.length > 0 ? <p className="mt-2 text-xs text-neutral-400">{voiceParticipants.map(({ id, name }) => id === currentUserId ? `${name} (you)` : name).join(", ")}</p> : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                      {messages.length === 0 ? <p className="text-sm text-neutral-500">No messages yet. Start the conversation.</p> : null}
                      {messages.map((message) => (
                        <div key={message.id} className="rounded-lg border border-[#20392b] bg-[#14271f] px-3 py-2">
                          <p className="text-xs font-semibold text-[#d8e66d]">{message.author.name}</p>
                          <p className="mt-1 text-sm text-neutral-200">{message.body}</p>
                        </div>
                      ))}
                    </div>

                    <form onSubmit={sendMessage} className="mt-4 flex gap-2">
                      <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Message this channel" className="min-w-0 flex-1 rounded-lg border border-[#3b5a4b] bg-[#0b1913] px-3 py-2 text-sm text-white outline-none focus:border-[#d8e66d]" />
                      <button className="rounded-lg bg-[#d8e66d] px-3 py-2 text-sm font-semibold text-[#17251c] hover:bg-[#e5ef9b]" aria-label="Send message">Send</button>
                    </form>
                  </>
                )}
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </>
  );
}
