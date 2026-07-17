import { CredentialsSignInForm } from "@/components/CredentialsSignInForm";

const ERROR_MESSAGES: Record<string, string> = {
  Configuration: "Sign-in isn't configured correctly on the server.",
  CredentialsSignin: "Incorrect email or password.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-center text-lg font-bold text-slate-900">Real Estate ROI Dashboard</h1>
        <p className="mt-1 text-center text-sm text-slate-500">Sign in to continue</p>

        {error && (
          <p className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-center text-sm text-rose-600">
            {ERROR_MESSAGES[error] ?? "Something went wrong signing you in."}
          </p>
        )}

        <div className="mt-6">
          <CredentialsSignInForm />
        </div>
      </div>
    </div>
  );
}
