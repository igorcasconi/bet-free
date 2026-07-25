# Infra Setup Specification

## Problem Statement

O projeto `bet-free` foi criado via `create-next-app` e só tem Next.js 16 + React 19 + Tailwind v4 básicos. Nenhuma das dependências de aplicação (UI kit, data fetching, forms, validação, clients de backend) está instalada, e não há estrutura de pastas, padrões de env, nem providers. Sem essa base, nenhuma feature de negócio pode ser implementada seguindo o CLAUDE.md.

## Proposed Solution

Instalar e configurar toda a infraestrutura descrita no CLAUDE.md (TailwindCSS, shadcn/ui, React Query, React Hook Form, Zod, Firebase SDK, Supabase Client), criar a estrutura de pastas feature-first, e configurar imports absolutos, ESLint, Prettier, validação de env, Query Provider e Theme Provider — sem implementar nenhuma lógica de negócio. Ao final, `npm run dev` e `npm run build` funcionam com a base pronta para receber features.

## Goals

- [x] Todas as dependências instaladas e sem conflito de versão com Next.js 16 / React 19
- [x] `npm run build` e `npm run lint` passam sem erro
- [x] Estrutura de pastas criada conforme decisões (context.md)
- [x] Query Provider e Theme Provider envolvendo o app em `app/layout.tsx`
- [x] Env vars validadas em build-time via `@t3-oss/env-nextjs`

## Out of Scope

| Feature                                               | Reason                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------ |
| Qualquer feature de negócio (auth, apostas, rankings) | Fora do escopo desta rodada — ver context.md                 |
| Autenticação real (login/logout funcional)            | Requer Firebase configurado com projeto real, feature futura |
| Schema de banco no Supabase                           | Modelagem de domínio é feature futura                        |
| Testes automatizados de features                      | Não há feature para testar ainda                             |

---

## User Stories

### P1: Stack de UI e formulários instalado ⭐ MVP

**User Story**: Como desenvolvedor, quero TailwindCSS, shadcn/ui, React Hook Form e Zod configurados, para poder construir componentes e formulários validados sem setup manual.

**Why P1**: Sem UI kit e validação de formulário, nenhuma tela pode ser construída.

**Acceptance Criteria**:

1. WHEN rodo `npx shadcn@latest add button` THEN o CLI SHALL instalar o componente em `components/ui/` sem erro de config
2. WHEN importo `zodResolver` de `@hookform/resolvers/zod` em um form de teste THEN o build SHALL compilar sem erro de tipo
3. WHEN `components.json` do shadcn existe THEN ele SHALL apontar estilo `new-york`, cor base `neutral`, e alias `@/components`, `@/lib`, `@/hooks`

**Independent Test**: instalar um componente shadcn de teste (ex: `button`), renderizar em uma página, rodar `npm run build`.

---

### P1: Data fetching e clients de backend configurados ⭐ MVP

**User Story**: Como desenvolvedor, quero React Query, Firebase SDK e Supabase Client configurados com Query Provider, para poder buscar dados client-side e me conectar aos backends assim que houver features.

**Why P1**: É o mecanismo central de client-side data fetching definido no CLAUDE.md; sem ele, features de busca/filtro/mutação não têm onde se apoiar.

**Acceptance Criteria**:

1. WHEN o app renderiza THEN `app/layout.tsx` SHALL estar envolvido por um `QueryProvider` (Client Component) contendo `QueryClientProvider`
2. WHEN `NODE_ENV !== 'production'` THEN `ReactQueryDevtools` SHALL ser renderizado; WHEN `NODE_ENV === 'production'` THEN SHALL não ser renderizado
3. WHEN importo `lib/firebase/client.ts` THEN SHALL exportar uma instância de Firebase Auth inicializada a partir de env vars validadas
4. WHEN importo `lib/supabase/client.ts` THEN SHALL exportar um client Supabase inicializado a partir de env vars validadas
5. WHEN falta uma env var obrigatória (ex: `NEXT_PUBLIC_SUPABASE_URL`) THEN o build/dev SHALL falhar com erro claro do `@t3-oss/env-nextjs` apontando a var faltante

**Independent Test**: com `.env.local` preenchido, `npm run dev` sobe sem erro; removendo uma var obrigatória, o processo falha com mensagem clara.

---

### P1: Estrutura de pastas e convenções de projeto ⭐ MVP

**User Story**: Como desenvolvedor, quero a estrutura de pastas feature-first (`features/`, `components/`, `lib/`, `config/`, `hooks/`) e imports absolutos, para que futuras features sigam o padrão do CLAUDE.md desde o início.

**Why P1**: Base estrutural — todo o resto do CLAUDE.md (public API por feature, query keys centralizadas) depende dela existir.

**Acceptance Criteria**:

1. WHEN olho a raiz do projeto THEN SHALL existir `components/ui/`, `lib/`, `features/`, `config/`, `hooks/` (features/ pode estar vazio, com `.gitkeep` ou README)
2. WHEN importo algo com `@/` THEN o path SHALL resolver corretamente (tsconfig `paths` já configurado, sem alteração necessária)
3. WHEN olho `config/query-keys.ts` THEN SHALL existir um objeto `QUERY_KEYS` centralizado (mesmo que vazio/placeholder, pronto para receber chaves de features)

**Independent Test**: criar uma feature de exemplo (ex: `features/example/index.ts` vazio) e importar via `@/features/example` sem erro de resolução.

---

### P2: Lint e formatação consistentes

**User Story**: Como desenvolvedor, quero ESLint e Prettier configurados (incluindo ordenação de classes Tailwind), para manter consistência de código sem debate manual em PRs.

**Why P2**: Importante para qualidade de longo prazo, mas não bloqueia a primeira feature.

**Acceptance Criteria**:

1. WHEN rodo `npm run lint` THEN SHALL usar o `eslint.config.mjs` existente sem regressão
2. WHEN rodo `npx prettier --check .` THEN SHALL usar `.prettierrc` com `prettier-plugin-tailwindcss` habilitado
3. WHEN uma classe Tailwind está fora de ordem em um arquivo THEN `npx prettier --write` SHALL reordená-la automaticamente

**Independent Test**: escrever classes Tailwind fora de ordem em um componente de teste, rodar `prettier --write`, confirmar reordenação.

---

### P2: Theme Provider com suporte a dark mode

**User Story**: Como usuário, quero que a interface respeite meu tema do sistema operacional (claro/escuro), para não ter desconforto visual ao abrir o app.

**Why P2**: Melhora UX mas não bloqueia funcionalidade central.

**Acceptance Criteria**:

1. WHEN o app carrega pela primeira vez THEN o tema SHALL seguir a preferência do SO (`system`) sem flash de tema incorreto
2. WHEN inspeciono `app/layout.tsx` THEN SHALL estar envolvido por `ThemeProvider` (next-themes) com `attribute="class"` e `defaultTheme="system"`

**Independent Test**: alternar tema do SO entre claro/escuro e recarregar a página, confirmar que o app acompanha.

---

## Edge Cases

- WHEN uma env var obrigatória está ausente em dev THEN o servidor dev SHALL falhar ao subir com mensagem indicando qual var falta (não falha silenciosa)
- WHEN `NODE_ENV === 'production'` THEN React Query Devtools SHALL estar ausente do bundle (não apenas oculto via CSS)
- WHEN um componente shadcn é adicionado THEN SHALL respeitar os aliases configurados em `components.json`, sem exigir edição manual de imports

---

## Requirement Traceability

| Requirement ID | Story                                  | Phase    | Status       |
| -------------- | -------------------------------------- | -------- | ------------ |
| SETUP-01       | P1: Stack de UI e formulários          | In Tasks | Done         |
| SETUP-02       | P1: Data fetching e clients de backend | In Tasks | Done         |
| SETUP-03       | P1: Estrutura de pastas e convenções   | In Tasks | Done         |
| SETUP-04       | P2: Lint e formatação                  | In Tasks | Done         |
| SETUP-05       | P2: Theme Provider                     | In Tasks | Done         |

**Coverage:** 5 total, 5 mapped to tasks, 0 unmapped

---

## Success Criteria

- [x] `npm run build` e `npm run lint` passam sem erro
- [x] `npm run dev` sobe com Query Provider e Theme Provider ativos, sem erro de env
- [x] Estrutura de pastas presente e navegável conforme context.md
- [x] Nenhuma lógica de negócio implementada (apenas infraestrutura)
