import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/auth";
import { updateTaskSubmission } from "@/server/approvals";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const { taskId } = await context.params;
    const task = await updateTaskSubmission(session.user.id, taskId, await request.json());
    return NextResponse.json({ task });
  } catch (error) {
    if (error instanceof Error && ["SUBMISSION_EDIT_DENIED", "SUBMISSION_NOT_EDITABLE"].includes(error.message)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    if (error instanceof Error && error.message === "SUBMISSION_PERMANENTLY_REJECTED") {
      return NextResponse.json({ error: "PERMANENTLY_REJECTED" }, { status: 409 });
    }
    if (error instanceof Error && error.message === "TASK_NOT_FOUND") {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ error: "INVALID_TASK" }, { status: 400 });
  }
}
