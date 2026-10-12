import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/auth";
import { createTask, listProjectTasks } from "@/server/tasks";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const { projectId } = await context.params;
    const tasks = await listProjectTasks(session.user.id, projectId);
    return NextResponse.json({ tasks });
  } catch (error) {
    if (error instanceof Error && error.message === "PROJECT_ACCESS_DENIED") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const { projectId } = await context.params;
    const body = await request.json();
    const task = await createTask({ ...body, projectId, reporterId: session.user.id });
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && ["PROJECT_ACCESS_DENIED", "ASSIGNEE_NOT_IN_ORGANIZATION"].includes(error.message)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    return NextResponse.json({ error: "INVALID_TASK" }, { status: 400 });
  }
}
