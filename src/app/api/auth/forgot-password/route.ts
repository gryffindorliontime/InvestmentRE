import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/userStore";
import { createResetToken } from "@/lib/resetToken";
import { sendEmail } from "@/lib/sendEmail";

// Always responds the same way whether or not the account exists — an
// account-specific response here would let anyone probe which emails are
// registered.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? "")
    .trim()
    .toLowerCase();

  if (email) {
    const user = findUserByEmail(email);
    if (user) {
      const token = createResetToken(user.email);
      const resetUrl = new URL(`/reset-password?token=${token}`, request.nextUrl.origin).toString();
      await sendEmail({
        to: user.email,
        subject: "Reset your Real Estate ROI Dashboard password",
        text: `Someone (hopefully you) asked to reset the password for ${user.email}.\n\nReset it here (expires in 30 minutes):\n${resetUrl}\n\nIf you didn't request this, you can ignore this email.`,
        html: `<p>Someone (hopefully you) asked to reset the password for <strong>${user.email}</strong>.</p><p><a href="${resetUrl}">Reset your password</a> (expires in 30 minutes).</p><p>If you didn't request this, you can ignore this email.</p>`,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
