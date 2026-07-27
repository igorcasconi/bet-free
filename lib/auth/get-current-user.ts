import { cookies } from "next/headers";

import { adminAuth } from "@/lib/firebase/admin";

const SESSION_COOKIE_NAME = "__session";

export async function getCurrentFirebaseUid(): Promise<string | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    return null;
  }

  try {
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie);
    return decodedClaims.uid;
  } catch {
    return null;
  }
}
