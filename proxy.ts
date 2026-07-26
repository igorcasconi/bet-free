// Next.js 16 renamed the `middleware.ts` file convention to `proxy.ts` (the
// `middleware` filename is deprecated). This file replaces what design.md
// calls `middleware.ts` — same responsibility, current file convention.
// `proxy` always runs in the Node.js runtime, so no explicit runtime opt-in
// is needed (unlike the deprecated `middleware` convention, which required
// `export const config = { runtime: "nodejs" }` to use `firebase-admin`).
import { NextResponse, type NextRequest } from "next/server";

import { adminAuth } from "@/lib/firebase/admin";
import { decideRedirect } from "@/lib/auth/middleware-logic";

const SESSION_COOKIE_NAME = "__session";

export async function proxy(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  let hasValidSession = false;
  if (sessionCookie) {
    try {
      await adminAuth.verifySessionCookie(sessionCookie, true);
      hasValidSession = true;
    } catch {
      hasValidSession = false;
    }
  }

  const decision = decideRedirect({
    pathname: request.nextUrl.pathname,
    hasValidSession,
  });

  if (decision.action === "redirect") {
    return NextResponse.redirect(new URL(decision.to, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth/session|api/sync|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
