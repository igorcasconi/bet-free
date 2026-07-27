import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface MoneyPreservedCardProps {
  amount: number;
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function MoneyPreservedCard({ amount }: MoneyPreservedCardProps) {
  return (
    <Card className="bg-gradient-to-br from-emerald-500 to-emerald-700 p-6 text-white">
      <Badge variant="secondary" className="w-fit">
        Money Preserved
      </Badge>
      <p className="text-4xl font-bold">{currencyFormatter.format(amount)}</p>
    </Card>
  );
}
