import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "PUBLIC_SIGNUP_DISABLED" }, { status: 410 });
}
