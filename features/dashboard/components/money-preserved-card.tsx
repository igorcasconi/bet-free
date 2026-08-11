import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import Image from "next/image";

interface MoneyPreservedCardProps {
  amount: number;
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function MoneyPreservedCard({ amount }: MoneyPreservedCardProps) {
  return (
    <Card className="flex w-full flex-row justify-between bg-linear-to-br from-emerald-500 to-emerald-700 p-6 text-white">
      <div className="flex-col">
        <Badge variant="secondary" className="w-fit">
          Dinheiro Poupado
        </Badge>
        <p className="mt-10 text-4xl font-bold">
          {currencyFormatter.format(amount)}
        </p>
      </div>
      <Image
        src="/bet-free-images/saved-illustration.png"
        alt="Ilustração de dinheiro poupado crescendo em vez de ser apostado"
        width={480}
        height={480}
        className="h-35 w-47.5 max-w-md"
        priority
      />
    </Card>
  );
}
