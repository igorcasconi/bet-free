"use client";

import { Button } from "@/components/ui/button";

export default function MatchesError({ reset }: { reset: () => void }) {
  return (
    <div className="flex flex-col gap-6 p-6">
      <p className="text-muted-foreground text-sm">
        Não foi possível carregar as partidas.
      </p>
      <Button type="button" variant="outline" onClick={reset}>
        Tentar novamente
      </Button>
    </div>
  );
}
