import Image from "next/image";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 bg-linear-to-r from-green-400 to-blue-500 px-4 py-12">
      <div className="mr-10 max-w-lg items-center">
        <Image
          src="/bet-free-images/saved-illustration.png"
          alt="Ilustração de dinheiro poupado crescendo em vez de ser apostado"
          width={480}
          height={480}
          className="h-auto w-full max-w-md items-center"
          priority
        />
        <div className="items-center gap-4 md:items-start">
          <h1 className="md:text-5x mb-3 text-3xl font-bold">
            Seu amor pelo futebol não precisa custar seu dinheiro.
          </h1>
          <p className="text-lg text-zinc-950">
            Você pode continuar acompanhando cada jogo, fazendo seus palpites e
            torcendo. -- Sem colocar seu dinheiro em risco.
          </p>
        </div>
      </div>
      <div className="mt-30 w-full max-w-sm space-y-6">{children}</div>
    </div>
  );
}
