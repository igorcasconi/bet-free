import Link from "next/link";

import { Button } from "@/components/ui/button";

export function FinalCtaSection() {
  return (
    <section className="flex flex-col items-center gap-6 bg-linear-to-r from-green-400 to-blue-500 px-18 py-16 text-center">
      <h2 className="text-2xl font-bold sm:text-3xl">
        Hoje você pode fazer diferente.
      </h2>
      <p className="text-md text-zinc-950">
        Faça seu próximo palpite sem colocar seu dinheiro em jogo.
      </p>
      <p className="text-md my-[-20px] mb-2 text-zinc-950">
        Seu dinheiro é seu. O futebol pode continuar sendo diversão.
      </p>
      <Button asChild size="lg">
        <Link href="/login">Acessar a plataforma</Link>
      </Button>
    </section>
  );
}
