"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { UserCredential } from "firebase/auth";

import { mapFirebaseError } from "@/features/auth/services/auth-service";
import { syncSession } from "@/features/auth/actions/session-actions";
import type { EmailPasswordCredentials } from "@/features/auth/types";

export function useEmailPasswordMutation(
  authFn: (email: string, password: string) => Promise<UserCredential>,
  redirectTo?: string,
) {
  const router = useRouter();

  return useMutation({
    mutationFn: async ({ email, password }: EmailPasswordCredentials) => {
      const credential = await authFn(email, password);
      const idToken = await credential.user.getIdToken();
      await syncSession(idToken);
    },
    onSuccess: () => {
      router.push(redirectTo ?? "/home");
    },
    onError: (error) => {
      toast.error(mapFirebaseError(error));
    },
  });
}
