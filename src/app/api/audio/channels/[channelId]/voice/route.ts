import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/auth";
import { joinVoiceChannel, leaveVoiceChannel, pollVoiceChannel, sendVoiceSignal } from "@/server/audio";

type RouteContext = { params: Promise<{ channelId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { channelId } = await params;
  try {
    return NextResponse.json(await pollVoiceChannel(session.user.id, channelId));
  } catch (error) {
    if (error instanceof Error && error.message === "AUDIO_ACCESS_DENIED") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    if (error instanceof Error && error.message === "CONFERENCE_NOT_LIVE") return NextResponse.json({ error: "CONFERENCE_NOT_LIVE" }, { status: 409 });
    return NextResponse.json({ error: "VOICE_POLL_FAILED" }, { status: 400 });
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { channelId } = await params;
  try {
    const body = await request.json();
    if (body?.action === "leave") {
      await leaveVoiceChannel(session.user.id, channelId);
      return NextResponse.json({ ok: true });
    }
    if (body?.action === "signal") {
      await sendVoiceSignal(session.user.id, channelId, body.signal);
      return NextResponse.json({ ok: true }, { status: 201 });
    }
    if (body?.action === "join") {
      return NextResponse.json(await joinVoiceChannel(session.user.id, channelId), { status: 201 });
    }
    return NextResponse.json({ error: "INVALID_VOICE_ACTION" }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "AUDIO_ACCESS_DENIED") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    if (error instanceof Error && error.message === "CONFERENCE_NOT_LIVE") return NextResponse.json({ error: "CONFERENCE_NOT_LIVE" }, { status: 409 });
    if (error instanceof Error && error.message === "VOICE_SENDER_NOT_JOINED") return NextResponse.json({ error: "VOICE_NOT_JOINED" }, { status: 403 });
    if (error instanceof Error && error.message === "VOICE_RECIPIENT_NOT_FOUND") return NextResponse.json({ error: "VOICE_RECIPIENT_NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ error: "INVALID_VOICE_REQUEST" }, { status: 400 });
  }
}