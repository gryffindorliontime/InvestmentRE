import { GoogleSignInButton } from "@/components/GoogleSignInButton";

const ERROR_MESSAGES: Record<string, string> = {
  Configuration: "Google sign-in isn't configured yet (missing client ID/secret on the server).",
  AccessDenied: "Access was denied.",
  OAuthSignin: "Couldn't start the Google sign-in flow. Try again.",
  OAuthCallback: "Google sign-in failed. Try again.",
  OAuthAccountNotLinked: "That Google account is already linked to a different sign-in method.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const configured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-center text-lg font-bold text-slate-900">Real Estate ROI Dashboard</h1>
        <p className="mt-1 text-center text-sm text-slate-500">Sign in to continue</p>

        <div className="mt-6">
          <GoogleSignInButton />
        </div>

        {error && (
          <p className="mt-4 text-center text-sm text-rose-600">
            {ERROR_MESSAGES[error] ?? "Something went wrong signing you in."}
          </p>
        )}
        {!configured && !error && (
          <p className="mt-4 text-center text-xs text-amber-600">
            Google sign-in isn&apos;t configured yet — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.
          </p>
        )}
      </div>
    </div>
  );
}
