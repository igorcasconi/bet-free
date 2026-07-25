import {
  GoogleAuthProvider,
  getRedirectResult,
  signInWithEmailAndPassword,
  signInWithRedirect,
  signOut,
  createUserWithEmailAndPassword,
  type UserCredential,
} from "firebase/auth";

import { auth } from "@/lib/firebase/client";

export function signInWithEmail(
  email: string,
  password: string,
): Promise<UserCredential> {
  return signInWithEmailAndPassword(auth, email, password);
}

export function signUpWithEmail(
  email: string,
  password: string,
): Promise<UserCredential> {
  return createUserWithEmailAndPassword(auth, email, password);
}

export function signInWithGoogleRedirect(): Promise<void> {
  return signInWithRedirect(auth, new GoogleAuthProvider());
}

export function resolveGoogleRedirect(): Promise<UserCredential | null> {
  return getRedirectResult(auth);
}

export function signOutClient(): Promise<void> {
  return signOut(auth);
}

const FIREBASE_ERROR_MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "Email ou senha incorretos",
  "auth/user-not-found": "Email ou senha incorretos",
  "auth/wrong-password": "Email ou senha incorretos",
  "auth/email-already-in-use": "Este email já está cadastrado",
  "auth/too-many-requests": "Muitas tentativas. Tente novamente mais tarde.",
};

const FALLBACK_MESSAGE = "Algo deu errado, tente novamente";

function getFirebaseErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const { code } = error as { code: unknown };
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

export function mapFirebaseError(error: unknown): string {
  const code = getFirebaseErrorCode(error);
  if (!code) return FALLBACK_MESSAGE;
  return FIREBASE_ERROR_MESSAGES[code] ?? FALLBACK_MESSAGE;
}
