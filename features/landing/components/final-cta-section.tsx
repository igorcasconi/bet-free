import Link from "next/link";

import { Button } from "@/components/ui/button";

export function FinalCtaSection() {
  return (
    <section className="flex flex-col items-center gap-6 px-6 py-16 text-center">
      <h2 className="text-2xl font-bold sm:text-3xl">
        Chega de apostar dinheiro real. Comece a ganhar de verdade.
      </h2>
      <Button asChild size="lg">
        <Link href="/login">Acessar a plataforma</Link>
      </Button>
    </section>
  );
}
