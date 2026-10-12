import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/auth";
import { createChannelMessage, listChannelMessages } from "@/server/audio";

type Context = { params: Promise<{ channelId: string }> };

export async function GET(_request: Request, context: Context) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    const { channelId } = await context.params;
    return NextResponse.json({ messages: await listChannelMessages(session.user.id, channelId) });
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
}

export async function POST(request: Request, context: Context) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    const { channelId } = await context.params;
    return NextResponse.json({ message: await createChannelMessage(session.user.id, channelId, await request.json()) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "INVALID_MESSAGE" }, { status: 400 });
  }
}
