import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/auth";
import { decideTaskApproval } from "@/server/approvals";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const { taskId } = await context.params;
    const task = await decideTaskApproval(session.user.id, taskId, await request.json());
    return NextResponse.json({ task });
  } catch (error) {
    if (error instanceof Error && error.message === "APPROVAL_ACCESS_DENIED") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    if (error instanceof Error && error.message === "TASK_NOT_FOUND") {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    if (error instanceof Error && error.message === "APPROVAL_ALREADY_DECIDED") {
      return NextResponse.json({ error: "ALREADY_DECIDED" }, { status: 409 });
    }

    return NextResponse.json({ error: "INVALID_APPROVAL" }, { status: 400 });
  }
}
