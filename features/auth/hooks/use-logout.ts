"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { signOutClient, mapFirebaseError } from "@/features/auth/services/auth-service";
import { clearSession } from "@/features/auth/actions/session-actions";

export function useLogout() {
  const router = useRouter();

  return useMutation({
    mutationFn: async () => {
      await Promise.all([signOutClient(), clearSession()]);
    },
    onSuccess: () => {
      router.push("/login");
    },
    onError: (error) => {
      toast.error(mapFirebaseError(error));
    },
  });
}
