"use client";

import { signUpWithEmail } from "@/features/auth/services/auth-service";
import { useEmailPasswordMutation } from "@/features/auth/hooks/use-email-password-mutation";

export function useSignUp(redirectTo?: string) {
  return useEmailPasswordMutation(signUpWithEmail, redirectTo);
}
