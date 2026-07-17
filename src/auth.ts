import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// Google sign-in only — no credentials/passwords in this app. Requires
// GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET (Google Cloud Console OAuth client)
// and AUTH_SECRET (session signing) in the environment; see
// .env.local.example. Sign-in fails with a clear provider error until those
// are set to real values — this file itself doesn't need edits either way.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  // Needed behind a platform reverse proxy (e.g. Vercel) — otherwise Auth.js
  // rejects the forwarded host header with an UntrustedHost error.
  trustHost: true,
});
