# Review — infra-setup

## Review Summary

| | |
|---|---|
| **Mode** | Local (working tree não commitado, branch `main`, sem base separada) |
| **Scope** | 20 arquivos, 0 commits (mudanças uncommitted/untracked) |
| **Subagents** | 6 de 6 — Security, Requirements, Tests, Architecture, Regression, Performance |
| **Docs loaded** | `infra-setup/spec.md`, `infra-setup/context.md`, `infra-setup/tasks.md`, `CLAUDE.md` |
| **Findings** | 11 across 8 files |

---

### SECURITY (0)

Nenhum finding com confiança ≥80%. Nenhum segredo hardcoded, `.env.example` só com placeholders, `.gitignore` ignora `.env*` exceto `.env.example`, chaves client-side (Firebase config, Supabase anon key) usadas corretamente (protegidas por Security Rules/RLS, não por sigilo).

### CRITICAL (1)

- `lib/env.ts` — validação de env nunca é exercitada: `lib/firebase/client.ts` e `lib/supabase/client.ts` não são importados por nenhum arquivo da aplicação (`app/layout.tsx`, `app/page.tsx`, providers). `npm run build` sem nenhuma env var setada passa limpo, contrariando diretamente o critério SETUP-02.5 e o edge case do spec.md ("falta de env var obrigatória SHALL falhar com erro claro"). Verificado de forma independente via `grep` — confirmado.
  - **Recomendação:** importar (mesmo que só para side-effect) `lib/env.ts` num ponto de entrada real (ex: `app/layout.tsx` ou um dos providers), ou aceitar explicitamente como débito conhecido até a primeira feature de auth/dados consumir esses clients — mas documentar a decisão em vez de deixar a lacuna silenciosa.

### PERFORMANCE (1)

- `config/providers/query-provider.tsx:2-4,13` — `ReactQueryDevtools` importado estaticamente no topo do arquivo; o guard `NODE_ENV !== "production"` evita o *render*, mas não garante tree-shaking do *import*, podendo inflar o bundle client de produção.
  - **Recomendação:** usar import dinâmico (`next/dynamic` com `ssr: false`) condicionado a dev, ou `require()` condicional.

### WARNING (0)

### SUGGESTION (9)

- `lib/env.ts:4` — bloco `server: {}` vazio; ao adicionar `service_role`/Firebase Admin credentials no futuro, garantir que entrem em `server`, nunca `client`, e nunca sejam importados por arquivos `"use client"`.
- `lib/env.ts:4-16` — sem teste do schema Zod (decisão documentada de "sem testes nesta rodada" é respeitada; registrar como débito barato para a próxima feature).
- `lib/firebase/client.ts:12` — guard de re-init (`getApps().length ? getApp() : initializeApp(...)`) sem teste; lógica pequena mas fácil de quebrar silenciosamente numa refatoração futura.
- `lib/supabase/client.ts:5-8` — sem guard explícito de singleton (diferente do padrão do Firebase client); funciona por module-caching do JS, mas é uma assimetria de padrão entre os dois clients.
- `config/query-keys.ts:1` — path `config/` diverge do exemplo ilustrativo em `CLAUDE.md` (`constants/`), mas bate com a decisão explícita do `context.md`. Sem ação necessária.
- `next.config.ts:3` — objeto `NextConfig` colapsado numa linha após passagem do Prettier; cosmético, mas destoa do padrão original do `create-next-app`. Reverter se legibilidade for prioridade.
- `package.json:24,29` — `react-hook-form`/`@hookform/resolvers` instalados mas ainda sem nenhum uso no código; esperado para um PR de infra, mas acompanhar que a próxima feature de formulário efetivamente consuma essas deps.
- `package.json`/instalação — conflito ERESOLVE real (não relacionado às versões escolhidas) obrigou `--legacy-peer-deps`; a flag está documentada só em `.specs/features/infra-setup/tasks.md`, que outro dev/CI não lê. Adicionar `.npmrc` com `legacy-peer-deps=true` ou documentar em README.
- `features/README.md:1` — `features/` ainda sem subpasta/`index.ts` real (aceitável, é placeholder); validar quando a primeira feature nascer que já inclua API pública via `index.ts`.

---

### Files With No Findings

- `.gitignore`, `AGENTS.md`, `app/globals.css`, `app/page.tsx`, `app/layout.tsx`, `components.json`, `components/ui/button.tsx`, `.env.example`, `.prettierrc`, `config/providers/theme-provider.tsx`, `package-lock.json`, `lib/utils.ts`

---

### Highlights

- **Security:** separação client/server de env vars via `@t3-oss/env-nextjs` bem aplicada — nenhuma chave sensível vazou pro bundle client.
- **Tests:** decisão de "sem testes nesta rodada" está rastreável de forma exemplar em `tasks.md` (`**Tests**: none` em cada task), tornando a ausência auditável em vez de omissão silenciosa.
- **Architecture:** separação Firebase(Auth)/Supabase(DB) implementada com disciplina — `lib/firebase/client.ts` só expõe `auth`, sem vazamento de outros serviços; `lib/env.ts` centraliza 100% das env vars, sem `process.env` disperso.
- **Regression:** todos os imports auditados são reais (zod, radix-ui via pacote consolidado, firebase subpath exports, supabase-js) — nenhum import fantasma ou API alucinada.
- **Performance:** `QueryClient` criado via `useState` (não recriado a cada render) e Firebase guardado contra reinicialização em HMR — padrões corretos.
- **Requirements:** 12 de 15 critérios de aceite verificados como PASS; a única falha real (SETUP-02.5) foi isolada com precisão e evidência reproduzível.
