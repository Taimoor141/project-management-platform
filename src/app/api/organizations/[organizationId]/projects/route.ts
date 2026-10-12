import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/auth";
import { createProject, listOrganizationProjects } from "@/server/organizations";

type RouteContext = {
  params: Promise<{ organizationId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const { organizationId } = await context.params;
    const projects = await listOrganizationProjects(session.user.id, organizationId);
    return NextResponse.json({ projects });
  } catch (error) {
    if (error instanceof Error && error.message === "USER_NOT_IN_ORGANIZATION") {
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
    const { organizationId } = await context.params;
    const body = await request.json();
    const project = await createProject({
      organizationId,
      name: body.name,
      key: body.key,
      createdByUserId: session.user.id,
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "USER_NOT_IN_ORGANIZATION") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    return NextResponse.json({ error: "INVALID_PROJECT" }, { status: 400 });
  }
}
