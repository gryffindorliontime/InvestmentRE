"use client";

import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => {});
    setSubmitting(false);
    // Always show the same confirmation, whether or not the account exists.
    setSent(true);
  }

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-center text-lg font-bold text-slate-900">Forgot password or sign-in ID?</h1>
        <p className="mt-1 text-center text-sm text-slate-500">
          Your sign-in ID is the email address you were given. Enter it below and we&apos;ll send a
          password reset link if an account exists for it.
        </p>

        {sent ? (
          <p className="mt-6 rounded-md bg-emerald-50 px-3 py-3 text-center text-sm text-emerald-700">
            If an account exists for that email, a reset link is on its way. Check the inbox (and the
            server console, if this app isn&apos;t configured to send real email yet).
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs text-slate-600">
              Email
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <Link href="/login" className="mt-4 block text-center text-xs text-blue-600 hover:underline">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
