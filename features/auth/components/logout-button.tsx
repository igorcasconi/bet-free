"use client";

import { Button } from "@/components/ui/button";
import { useLogout } from "@/features/auth/hooks/use-logout";

export function LogoutButton() {
  const { mutate, isPending } = useLogout();

  return (
    <Button
      type="button"
      variant="default"
      disabled={isPending}
      className="bg-red-500"
      onClick={() => mutate()}
    >
      Sair
    </Button>
  );
}
