import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section className="flex flex-col items-center gap-8 px-6 py-16 text-center md:flex-row md:text-left">
      <div className="flex flex-1 flex-col items-center gap-4 md:items-start">
        <h1 className="text-3xl font-bold md:text-5xl">
          Transforme o impulso de apostar em previsões grátis e gamificadas
        </h1>
        <p className="text-muted-foreground text-lg">
          Sinta a emoção do palpite sem arriscar seu dinheiro: preveja
          resultados, ganhe XP e acompanhe quanto você deixou de perder.
        </p>
        <Button asChild size="lg">
          <Link href="/login">Acessar a plataforma</Link>
        </Button>
      </div>
      <div className="flex-1">
        <Image
          src="/bet-free-images/saved-illustration.png"
          alt="Ilustração de dinheiro poupado crescendo em vez de ser apostado"
          width={480}
          height={480}
          className="h-auto w-full max-w-md"
          priority
        />
      </div>
    </section>
  );
}
