import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section className="flex flex-col items-center gap-8 bg-linear-to-r from-green-400 to-blue-500 px-18 py-16 text-center md:flex-row md:text-left">
      <div className="flex flex-1 flex-col items-center gap-4 md:items-start">
        <h1 className="text-3xl font-bold md:text-5xl">
          Seu amor pelo futebol não precisa custar seu dinheiro.
        </h1>
        <p className="text-lg text-zinc-950">
          Você pode continuar acompanhando cada jogo, fazendo seus palpites e
          torcendo — sem colocar seu dinheiro em risco.
        </p>
        <Button asChild size="lg">
          <Link href="/login">Começar gratuitamente</Link>
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
