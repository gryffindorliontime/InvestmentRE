"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ durable: boolean; syncedToGitHub: boolean } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to reset password.");
      setDone({ durable: data.durable, syncedToGitHub: data.syncedToGitHub });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <p className="mt-4 text-center text-sm text-rose-600">
        This reset link is missing its token. Request a new one from the forgot-password page.
      </p>
    );
  }

  if (done) {
    return (
      <div className="mt-4 space-y-3">
        <p className="rounded-md bg-emerald-50 px-3 py-3 text-center text-sm text-emerald-700">
          Password updated. You can sign in with your new password now.
        </p>
        {done.syncedToGitHub ? (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-center text-xs text-emerald-700">
            This change was committed to the app&apos;s source and will be permanent everywhere once the
            next deploy finishes (usually under a minute).
          </p>
        ) : (
          !done.durable && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-center text-xs text-amber-700">
              This server has no persistent storage configured, so the change may not survive a restart
              or redeploy — see the app&apos;s setup notes.
            </p>
          )
        )}
        <Link href="/login" className="block text-center text-sm font-medium text-blue-600 hover:underline">
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-xs text-slate-600">
        New password
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
        />
        <span className="text-[11px] text-slate-400">At least 8 characters.</span>
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-600">
        Confirm new password
        <input
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
        />
      </label>

      {error && <p className="text-xs text-rose-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? "Resetting…" : "Reset password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-center text-lg font-bold text-slate-900">Reset your password</h1>
        <Suspense fallback={<p className="mt-4 text-center text-sm text-slate-400">Loading…</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
