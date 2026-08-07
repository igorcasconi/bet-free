import { MoneyPreservedCard } from "@/features/dashboard";
import { MOCK_LANDING_STATS } from "@/features/landing/constants/mock-stats";

export function MoneyPreservedSection() {
  return (
    <section className="flex flex-col items-center gap-4 text-center">
      <h2 className="text-2xl font-bold">Veja quanto você preservaria</h2>
      <p className="text-muted-foreground">
        Um exemplo real de como o BetFree ajuda você a manter seu dinheiro.
      </p>
      <MoneyPreservedCard amount={MOCK_LANDING_STATS.moneySaved} />
    </section>
  );
}
