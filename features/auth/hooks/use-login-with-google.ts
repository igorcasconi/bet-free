"use client";

import { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  signInWithGoogleRedirect,
  resolveGoogleRedirect,
  mapFirebaseError,
} from "@/features/auth/services/auth-service";
import { syncSession } from "@/features/auth/actions/session-actions";

export function useLoginWithGoogle(redirectTo?: string) {
  const router = useRouter();

  const signIn = useMutation({
    mutationFn: signInWithGoogleRedirect,
    onError: (error) => {
      toast.error(mapFirebaseError(error));
    },
  });

  const resolveRedirect = useCallback(async () => {
    try {
      const credential = await resolveGoogleRedirect();
      if (!credential) return;

      const idToken = await credential.user.getIdToken();
      await syncSession(idToken);
      router.push(redirectTo ?? "/home");
    } catch (error) {
      toast.error(mapFirebaseError(error));
    }
  }, [redirectTo, router]);

  return { signIn: signIn.mutate, isPending: signIn.isPending, resolveRedirect };
}
