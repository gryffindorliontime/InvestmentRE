import { NextResponse } from "next/server";
import { auth } from "@/auth";

const PUBLIC_PATHS = ["/login"];

// Gates every page and API route behind a Google session, except /login
// itself and Auth.js's own /api/auth/* routes (which the sign-in flow
// needs open to complete the OAuth handshake).
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
