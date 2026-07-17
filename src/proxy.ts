import { NextResponse } from "next/server";
import { auth } from "@/auth";

const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password"];

// Gates every page and API route behind a session, except the sign-in and
// password-recovery pages, and Auth.js's own /api/auth/* routes (which both
// the OAuth handshake and the forgot/reset-password API routes live under —
// all need to work for a signed-out visitor).
export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/auth")) return NextResponse.next();

  const isPublicPath = PUBLIC_PATHS.includes(pathname);
  if (!req.auth && !isPublicPath) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  if (req.auth && pathname === "/login") {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
