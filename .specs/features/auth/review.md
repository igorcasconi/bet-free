# Review — auth (Firebase Authentication)

## Review Summary

| | |
|---|---|
| **Mode** | Local (working tree não commitado, branch `main`, base `6f4bc24`) |
| **Scope** | 30 arquivos (25 novos + 5 modificados), 0 commits (uncommitted) |
| **Subagents** | 6 de 6 — Security, Requirements, Tests, Architecture, Regression, Performance |
| **Docs loaded** | `auth/spec.md`, `auth/context.md`, `auth/design.md`, `auth/tasks.md`, `CLAUDE.md` |
| **Findings** | 13 across 10 files |

---

### SECURITY (1)

- `proxy.ts:19`, `app/api/auth/session/route.ts` (`DELETE`) — Sessão não é revogável server-side: `verifySessionCookie` é chamado sem `checkRevoked=true`, e o logout não chama `adminAuth.revokeRefreshTokens(uid)`. Se o cookie `__session` vazar, ele continua válido por até 5 dias mesmo após "logout" no dispositivo legítimo.
  - **Recomendação:** `verifySessionCookie(sessionCookie, true)` no `proxy.ts` + `revokeRefreshTokens` no handler `DELETE`.

### CRITICAL (0)

Nenhum. (O finding sobre `.env.local` reportado pelo Regression foi verificado — é um arquivo local gitignored com dado sintético/placeholder mal preenchido em fases anteriores, não faz parte do diff/commit. Corrigido durante esta review; ver nota abaixo.)

### PERFORMANCE (1)

- `features/auth/hooks/use-logout.ts:12-15` — `signOutClient()` e `clearSession()` rodam sequencialmente apesar de serem independentes (um fala com o SDK client, outro faz `fetch` pro Route Handler). `Promise.all`/`Promise.allSettled` reduziria a latência do logout ao maior dos dois em vez da soma.

### WARNING (3)

- `app/layout.tsx:37-42` — `<Toaster />` renderizado **fora** de `<ThemeProvider>`. Confirmei que `components/ui/sonner.tsx` usa `useTheme()` do `next-themes`, que só funciona dentro do provider — toasts não acompanham dark/light mode.
- `features/auth/hooks/use-login.ts` vs `use-sign-up.ts` — duplicação real linha a linha (mesmo `useMutation`, mesmo `onSuccess`/`onError`, só muda `signInWithEmail` vs `signUpWithEmail`). Candidato real a extração (`useEmailPasswordMutation`), não especulativa — os dois casos já existem.
- `features/auth/actions/session-actions.ts:1` — falta o comentário de justificativa que o próprio `design.md` (seção "Tech Decisions") exige para explicar por que "actions" aqui são wrappers de `fetch`, não Server Actions literais.

### SUGGESTION (7)

- **Gap funcional (Requirements):** `LogoutButton` é exportado por `features/auth/index.ts` mas não é renderizado em nenhuma página real — `app/page.tsx` continua sendo o boilerplate do `create-next-app`. Hoje não há como um usuário deslogar pela UI. Não é uma falha de nenhum critério de aceite (a spec descreve o componente/fluxo, não exige página), mas é um gap prático real antes de considerar a feature "usável" fora de testes manuais diretos na API.
- `features/auth/index.ts:7` — exporta `useLoginWithGoogle`, que não constava na lista original de `design.md`. Uso correto e necessário (a página de login precisa de `resolveRedirect()`), mas o desvio não tem nenhum marcador/comentário — só descoberto por comparação manual com o design.
- `proxy.ts:19-24` / `app/api/auth/session/route.ts` (`POST`) — catches genéricos não logam o erro internamente, dificultando diferenciar "cookie expirado" (esperado) de falha real de configuração do Admin SDK.
- `app/api/auth/session/route.ts` — lógica de expiração/opções do cookie duplicada entre `POST` e `DELETE`; sem problema hoje, mas se crescer vale extrair uma função pura testável.
- `features/auth/services/auth-service.ts:49-55` — branch `typeof code === "string"` do helper interno `getFirebaseErrorCode` não tem teste direto de código não-string (coberto indiretamente, risco baixo).
- Ambiente local: `.env.local` (gitignored, fora do diff) tinha `NEXT_PUBLIC_FIREBASE_API_KEY` preenchida com uma chave privada RSA por engano e `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` com uma URL do Google OAuth em vez do formato `<project>.firebaseapp.com`. Corrigido durante esta review (não é um problema do código/commit, mas do ambiente local das fases anteriores).
- `middleware-logic.ts`/`auth-service.ts` — nenhuma lógica pura ficou sem teste; a decisão de escopo (só lógica pura testada) foi seguida com disciplina.

---

### Files With No Findings

- `.env.example`, `lib/env.ts`, `package.json`, `package-lock.json`, `components/ui/form.tsx`, `components/ui/input.tsx`, `components/ui/label.tsx`, `features/auth/components/auth-provider.tsx`, `features/auth/components/login-form.tsx`, `features/auth/components/sign-up-form.tsx`, `features/auth/components/google-login-button.tsx`, `features/auth/types/index.ts`, `lib/firebase/admin.ts`, `vitest.config.mts`, `app/(auth)/layout.tsx`

---

### Highlights

- **Security:** fail-closed exemplar em `proxy.ts`/`middleware-logic.ts` — qualquer erro de verificação do cookie vira "não autenticado", nunca um bypass. Separação client/server de credenciais (`lib/env.ts` + isolamento de `lib/firebase/admin.ts`) impecável.
- **Requirements:** 19/19 critérios de aceite verificados como PASS contra o código real; único gap é funcional (botão de logout não montado), não de acceptance criteria.
- **Tests:** `middleware-logic.test.ts` testa o objeto de decisão inteiro (`toEqual`), não campos soltos — evita teste de detalhe de implementação; escopo "só lógica pura" seguido com disciplina.
- **Architecture:** divisão Context (sessão) vs React Query (mutações) aplicada literalmente como decidido em `context.md` — raro ver essa disciplina sem nenhuma tentativa de usar Context pra cache de servidor.
- **Regression:** nenhum import fantasma (todos os símbolos do Firebase Admin/client, sonner, radix-ui verificados contra `node_modules`); convenção `proxy.ts` (em vez de `middleware.ts`) confirmada como real via docs do próprio Next 16, não alucinação.
- **Performance:** singleton do Firebase Admin corretamente guardado contra HMR; `onAuthStateChanged` limpo no cleanup do `useEffect`; matcher do proxy exclui assets estáticos corretamente.
