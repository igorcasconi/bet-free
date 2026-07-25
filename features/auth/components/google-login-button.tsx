"use client";

import { Button } from "@/components/ui/button";
import { useLoginWithGoogle } from "@/features/auth/hooks/use-login-with-google";

export interface GoogleLoginButtonProps {
  redirectTo?: string;
}

export function GoogleLoginButton({ redirectTo }: GoogleLoginButtonProps) {
  const { signIn, isPending } = useLoginWithGoogle(redirectTo);

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      disabled={isPending}
      onClick={() => signIn()}
    >
      Entrar com Google
    </Button>
  );
}
