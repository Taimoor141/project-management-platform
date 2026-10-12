import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/auth";
import { createAudioChannel, listAudioChannels } from "@/server/audio";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  return NextResponse.json({ channels: await listAudioChannels(session.user.id) });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    const channel = await createAudioChannel(session.user.id, await request.json());
    return NextResponse.json({ channel }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "AUDIO_ADMIN_REQUIRED") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    return NextResponse.json({ error: "INVALID_CHANNEL" }, { status: 400 });
  }
}
