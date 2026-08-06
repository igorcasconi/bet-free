"use client";

import { Award, Calendar, Home, Trophy, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/home", label: "Início", icon: Home },
  { href: "/matches", label: "Partidas", icon: Calendar },
  { href: "/rankings", label: "Classificação", icon: Trophy },
  { href: "/achievements", label: "Conquistas", icon: Award },
  { href: "/profile", label: "Perfil", icon: User },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bg-background fixed right-0 bottom-0 left-0 z-50 flex items-center justify-around border-t md:hidden">
      {NAV_LINKS.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href;

        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "text-muted-foreground flex flex-col items-center gap-1 p-2 text-xs",
              isActive && "text-primary",
            )}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
