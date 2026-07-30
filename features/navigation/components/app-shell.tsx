import type { ReactNode } from "react";

import { BottomNav } from "@/features/navigation/components/bottom-nav";
import { PageViewTracker } from "@/features/navigation/components/page-view-tracker";
import { Sidebar } from "@/features/navigation/components/sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <PageViewTracker />
      <Sidebar />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <BottomNav />
    </div>
  );
}
