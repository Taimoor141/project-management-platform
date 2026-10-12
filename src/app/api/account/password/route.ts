import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/auth";
import { changeUserPassword } from "@/server/auth";

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    await changeUserPassword({ ...(await request.json()), userId: session.user.id });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "CURRENT_PASSWORD_INVALID") {
      return NextResponse.json({ error: "CURRENT_PASSWORD_INVALID" }, { status: 400 });
    }
    return NextResponse.json({ error: "INVALID_PASSWORD" }, { status: 400 });
  }
}
