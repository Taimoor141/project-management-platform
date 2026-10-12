import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/auth";
import { updateProjectSubmission } from "@/server/approvals";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const { projectId } = await context.params;
    const project = await updateProjectSubmission(session.user.id, projectId, await request.json());
    return NextResponse.json({ project });
  } catch (error) {
    if (error instanceof Error && ["SUBMISSION_EDIT_DENIED", "SUBMISSION_NOT_EDITABLE"].includes(error.message)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    if (error instanceof Error && error.message === "SUBMISSION_PERMANENTLY_REJECTED") {
      return NextResponse.json({ error: "PERMANENTLY_REJECTED" }, { status: 409 });
    }
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ error: "INVALID_PROJECT" }, { status: 400 });
  }
}
