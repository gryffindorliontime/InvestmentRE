import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { findUserByEmail, verifyPassword } from "./lib/userStore";

// Email/password only, checked against the account store in
// lib/userStore.ts (see lib/userSeed.ts for the seeded accounts). Needs
// AUTH_SECRET for session/token signing. See .env.local.example.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const user = findUserByEmail(email);
        if (!user || !verifyPassword(user, password)) return null;

        return { id: user.email, email: user.email, name: user.name };
      },
    }),
  ],
  // Credentials sign-in requires JWT sessions (no database adapter here to
  // back a database session).
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  // Needed behind a platform reverse proxy (e.g. Vercel) — otherwise Auth.js
  // rejects the forwarded host header with an UntrustedHost error.
  trustHost: true,
});
