import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/auth";
import { heartbeatPresence, listOrganizationPresence } from "@/server/presence";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    await heartbeatPresence(session.user.id);
    const members = await listOrganizationPresence(session.user.id);
    return NextResponse.json({ currentUserId: session.user.id, members });
  } catch {
    return NextResponse.json({ members: [] });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const status = body.status === "AWAY" ? "AWAY" : "ONLINE";
  try {
    const presence = await heartbeatPresence(session.user.id, status);
    return NextResponse.json({ presence });
  } catch {
    return NextResponse.json({ error: "SESSION_USER_NOT_FOUND" }, { status: 401 });
  }
}
