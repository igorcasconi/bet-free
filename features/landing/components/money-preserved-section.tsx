import { MoneyPreservedCard } from "@/features/dashboard";
import { MOCK_LANDING_STATS } from "@/features/landing/constants/mock-stats";

export function MoneyPreservedSection() {
  return (
    <section className="flex flex-col items-center gap-4 px-18 text-center">
      <h2 className="text-2xl font-bold">Veja quanto você preservaria</h2>
      <p className="text-muted-foreground">
        No BetFree, você pode descobrir o resultado sem colocar seu dinheiro em
        risco — e acompanhar quanto teria perdido se tivesse apostado.
      </p>
      <MoneyPreservedCard amount={MOCK_LANDING_STATS.moneySaved} />
    </section>
  );
}
