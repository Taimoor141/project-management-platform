import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/auth";
import { createConferenceCall, endConferenceCall } from "@/server/audio";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  try {
    const body = await request.json();

    if (body?.status === "ENDED" && body?.channelId) {
      const conference = await endConferenceCall(session.user.id, body.channelId);
      return NextResponse.json({ conference }, { status: 200 });
    }

    const conference = await createConferenceCall(session.user.id, body);
    return NextResponse.json({ conference }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && ["AUDIO_ADMIN_REQUIRED", "AUDIO_ACCESS_DENIED", "CONFERENCE_NOT_FOUND"].includes(error.message)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    return NextResponse.json({ error: "INVALID_CONFERENCE" }, { status: 400 });
  }
}
