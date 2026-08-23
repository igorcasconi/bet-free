import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/firebase/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";

const SESSION_COOKIE_NAME = "__session";
const SESSION_EXPIRES_IN_MS = 5 * 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  const { idToken } = (await request.json()) as { idToken?: string };

  if (!idToken) {
    return NextResponse.json({ error: "Missing idToken" }, { status: 401 });
  }

  let decodedToken;
  let sessionCookie;
  try {
    decodedToken = await adminAuth.verifyIdToken(idToken);
    sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_EXPIRES_IN_MS,
    });
  } catch {
    return NextResponse.json({ error: "Invalid idToken" }, { status: 401 });
  }

  // Firebase Auth has no webhook into our DB — this is the only place a
  // first-time signer-in ever passes through the server, so it's where the
  // `users` row (keyed by firebase_uid) must get created.
  const { error } = await supabaseAdmin.from("users").upsert(
    {
      firebase_uid: decodedToken.uid,
      email: decodedToken.email ?? null,
      display_name: decodedToken.name ?? null,
      avatar_url: decodedToken.picture ?? null,
    },
    { onConflict: "firebase_uid", ignoreDuplicates: true },
  );

  if (error) {
    return NextResponse.json({ error: "Failed to sync user" }, { status: 500 });
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_EXPIRES_IN_MS / 1000,
  });

  return new NextResponse(null, { status: 204 });
}

export async function DELETE() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionCookie) {
    try {
      const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie);
      await adminAuth.revokeRefreshTokens(decodedClaims.sub);
    } catch {
      // Cookie already invalid/expired — nothing to revoke, still clear it below.
    }
  }

  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return new NextResponse(null, { status: 204 });
}
