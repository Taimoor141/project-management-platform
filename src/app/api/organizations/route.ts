import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/auth";
import { createOrganization, listUserOrganizations } from "@/server/organizations";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const organizations = await listUserOrganizations(session.user.id);
  return NextResponse.json({ organizations });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const organization = await createOrganization({
      name: body.name,
      slug: body.slug,
      ownerId: session.user.id,
    });

    return NextResponse.json({ organization }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "ORGANIZATION_SLUG_TAKEN") {
      return NextResponse.json({ error: "SLUG_TAKEN" }, { status: 409 });
    }

    return NextResponse.json({ error: "INVALID_ORGANIZATION" }, { status: 400 });
  }
}
