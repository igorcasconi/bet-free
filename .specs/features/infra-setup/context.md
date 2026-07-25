# Infra Setup — Interview Decisions

**Date:** 2026-07-25
**Scope:** Configurar toda a infraestrutura base do projeto Next.js (Tailwind, shadcn/ui, React Query, React Hook Form, Zod, Firebase SDK, Supabase Client, estrutura de pastas, imports absolutos, ESLint, Prettier, validação de env, Query Provider, Theme Provider) sem implementar nenhuma feature de negócio.
**Source:** Discussão informal (comando `/interview` com argumentos de setup)

---

## Decisões

### Firebase / Supabase — divisão de responsabilidade

- Firebase = Authentication (client SDK).
- Supabase = Postgres DB + Storage (client JS).
- **Rationale:** separação clara de responsabilidade evita ambiguidade sobre qual backend chamar em cada caso de uso futuro.

### Validação de env

- `@t3-oss/env-nextjs` + `zod` para schema de env vars, separando `client`/`server`.
- Arquivo único de schema (`lib/env.ts` ou equivalente), importado em vez de `process.env` direto.
- **Rationale:** padrão de mercado para Next.js, erro de build claro quando falta var, evita vazamento de var server-only pro client.

### Theme Provider

- `next-themes` (mesma lib usada pelo shadcn/ui).
- Default: `system` (respeita preferência do SO), com suporte a toggle manual futuro.
- **Rationale:** evita flash de tema errado, é o padrão de facto do ecossistema shadcn.

### shadcn/ui — config

- Estilo: `new-york`.
- Cor base: `neutral`.
- **Rationale:** estilo mais compacto/moderno, cor neutra fácil de tematizar depois para a marca.

### Estrutura de pastas

- Raiz do projeto (sem `src/`), seguindo o padrão já existente (`app/` na raiz).
- `components/ui/` — componentes shadcn.
- `lib/` — clients (Supabase, Firebase), `env.ts`, `utils.ts`.
- `features/` — pastas por domínio (vazias por ora), seguindo estrutura pública via `index.ts` conforme CLAUDE.md.
- `config/` — `query-keys.ts`, providers (Query Provider, Theme Provider).
- `hooks/` — hooks globais (não específicos de feature).
- **Rationale:** alinhado ao CLAUDE.md (feature-first, public API por `index.ts`, shared code só quando genuinamente reutilizável).

### Prettier

- `prettier` + `prettier-plugin-tailwindcss` para ordenação automática de classes Tailwind.
- Integrado ao ESLint existente (flat config) sem conflito de regras de formatação (eslint-config-prettier se necessário).
- **Rationale:** evita bikeshedding de ordem de classes e diffs inconsistentes em PRs.

### React Query — Devtools

- `@tanstack/react-query-devtools` incluído no Query Provider, renderizado condicionalmente apenas quando `NODE_ENV !== 'production'`.
- **Rationale:** ajuda debugging em dev sem custo em produção.

---

## Agent's Discretion

- Nomenclatura exata de variáveis de env (prefixos, nomes específicos de projeto Firebase/Supabase) — usar convenção padrão de cada SDK.
- Estrutura interna de `lib/` (ex: `lib/supabase/client.ts` vs `lib/supabase.ts`) — usar boas práticas de cada SDK.
- Versões exatas das libs instaladas — usar últimas estáveis compatíveis com Next.js 16 / React 19.

---

## Deferred Ideas

- Nenhuma feature de negócio, página ou lógica de domínio — fora de escopo desta rodada.

---

## Open Questions

- Nenhuma pendente.
