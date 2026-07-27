import type { ReactNode } from "react";

import { BottomNav } from "@/features/navigation/components/bottom-nav";
import { Sidebar } from "@/features/navigation/components/sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <BottomNav />
    </div>
  );
}
