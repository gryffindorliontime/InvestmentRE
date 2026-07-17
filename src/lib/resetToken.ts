import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

// Self-verifying password-reset tokens: no server-side token storage needed
// (no database to put it in), so the token itself carries the email + an
// expiry, HMAC-signed with AUTH_SECRET. Anyone without the secret can't
// forge one; anyone with a valid, unexpired token can only reset the one
// email address it was issued for.
const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not set — required to sign password reset tokens.");
  return value;
}

function sign(payload: string): string {
  return base64url(createHmac("sha256", secret()).update(payload).digest());
}

export function createResetToken(email: string): string {
  const payload = base64url(JSON.stringify({ email, exp: Date.now() + TOKEN_TTL_MS }));
  return `${payload}.${sign(payload)}`;
}

// Returns the email the token was issued for, or null if the token is
// malformed, tampered with, or expired.
export function verifyResetToken(token: string): string | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const { email, exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof email !== "string" || typeof exp !== "number" || Date.now() > exp) return null;
    return email;
  } catch {
    return null;
  }
}
