import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  icon: LucideIcon;
  iconClassName: string; // e.g. "bg-amber-100 text-amber-600"
  value: string;
  label: string;
}

export function StatCard({
  icon: Icon,
  iconClassName,
  value,
  label,
}: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-full ${iconClassName}`}
        >
          <Icon className="size-5" aria-hidden="true" />
        </div>
        <div className="flex flex-col">
          <span className="text-2xl font-semibold">{value}</span>
          <span className="text-muted-foreground text-sm">{label}</span>
        </div>
      </CardContent>
    </Card>
  );
}
