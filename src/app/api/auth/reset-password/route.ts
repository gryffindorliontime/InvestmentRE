import { NextRequest, NextResponse } from "next/server";
import { verifyResetToken } from "@/lib/resetToken";
import { updatePassword } from "@/lib/userStore";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const token = String(body?.token ?? "");
  const password = String(body?.password ?? "");

  const email = verifyResetToken(token);
  if (!email) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired. Request a new one." },
      { status: 400 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const result = await updatePassword(email, password);
  if (!result.updated) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    persistedToDatabase: result.persistedToDatabase,
    durable: result.durable,
    syncedToGitHub: result.syncedToGitHub,
  });
}
