"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { LoginForm, SignUpForm, useLoginWithGoogle } from "@/features/auth";

function LoginPageContent() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? undefined;
  const [mode, setMode] = useState<"login" | "sign-up">("login");
  const { resolveRedirect } = useLoginWithGoogle(redirectTo);

  useEffect(() => {
    resolveRedirect();
  }, [resolveRedirect]);

  return (
    <div className="space-y-6">
      <h1 className="text-center text-2xl font-semibold tracking-tight">
        {mode === "login" ? "Entrar" : "Criar conta"}
      </h1>

      {mode === "login" ? (
        <LoginForm redirectTo={redirectTo} />
      ) : (
        <SignUpForm redirectTo={redirectTo} />
      )}

      {/* <GoogleLoginButton redirectTo={redirectTo} /> */}

      <button
        type="button"
        className="w-full cursor-pointer text-center text-sm text-white underline-offset-4 hover:underline dark:text-zinc-400"
        onClick={() => setMode(mode === "login" ? "sign-up" : "login")}
      >
        {mode === "login"
          ? "Não tem conta? Criar conta"
          : "Já tem conta? Entrar"}
      </button>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageContent />
    </Suspense>
  );
}
