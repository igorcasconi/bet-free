"use client";

import { signInWithEmail } from "@/features/auth/services/auth-service";
import { useEmailPasswordMutation } from "@/features/auth/hooks/use-email-password-mutation";

export function useLogin(redirectTo?: string) {
  return useEmailPasswordMutation(signInWithEmail, redirectTo);
}
