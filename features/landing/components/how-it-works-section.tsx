import type { LucideIcon } from "lucide-react";
import { PiggyBank, Target, Trophy } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Step {
  icon: LucideIcon;
  title: string;
  description: string;
}

const STEPS: Step[] = [
  {
    icon: Target,
    title: "Palpite grátis em jogos reais",
    description:
      "Dê seu palpite em partidas reais sem gastar um centavo — zero risco, zero aposta.",
  },
  {
    icon: Trophy,
    title: "Ganhe XP e mantenha sua streak",
    description:
      "Cada palpite certeiro rende XP e mantém sua sequência viva, subindo de nível como em um jogo.",
  },
  {
    icon: PiggyBank,
    title: "Veja o dinheiro preservado",
    description:
      "Acompanhe quanto você deixou de apostar e preservou, palpite após palpite.",
  },
];

export function HowItWorksSection() {
  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <h2 className="text-2xl font-semibold">Como funciona</h2>
        <p className="text-muted-foreground">
          Troque o impulso de apostar por uma experiência gamificada e sem
          risco.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, description }) => (
          <Card key={title}>
            <CardHeader>
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </div>
              <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>{description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
