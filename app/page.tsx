"use client";

import { LogoutButton, useAuth } from "@/features/auth";

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 font-sans dark:bg-black">
      <p className="text-lg text-zinc-600 dark:text-zinc-400">
        Logado como <span className="font-medium">{user?.email}</span>
      </p>
      <LogoutButton />
    </div>
  );
}
