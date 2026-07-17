"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import Link from "next/link";

export function CredentialsSignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await signIn("credentials", { email, password, redirect: false });
    setSubmitting(false);

    if (result?.error) {
      setError("Incorrect email or password.");
      return;
    }
    window.location.href = "/";
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
        <span className="text-[11px] text-slate-400">Your email is your sign-in ID.</span>
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-600">
        Password
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
        />
      </label>

      {error && <p className="text-xs text-rose-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? "Signing in…" : "Sign in"}
      </button>

      <Link href="/forgot-password" className="text-center text-xs text-blue-600 hover:underline">
        Forgot your password or sign-in ID?
      </Link>
    </form>
  );
}
