"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Award, Calendar, Home, Trophy, User } from "lucide-react";

import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/home", label: "Início", icon: Home },
  { href: "/matches", label: "Partidas", icon: Calendar },
  { href: "/rankings", label: "Classificação", icon: Trophy },
  { href: "/achievements", label: "Conquistas", icon: Award },
  { href: "/profile", label: "Perfil", icon: User },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="hidden bg-linear-30 to-blue-500 md:flex md:w-64 md:flex-col md:gap-1 md:border-r md:p-4">
      <div className="text-center">
        <h2 className="mb-2 text-2xl text-white">BetFree</h2>
      </div>
      {NAV_LINKS.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href;

        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "hover:bg-accent hover:text-accent-foreground flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-white transition-colors",
              isActive && "bg-accent text-accent-foreground",
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
