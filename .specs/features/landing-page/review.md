# Landing Page — Code Review

**Mode**: Local
**Scope**: 16 arquivos (4 modificados, 12 novos), mudanças não commitadas
**Subagents**: 6 de 6 (Security, Requirements, Tests, Architecture, Regression, Performance)
**Docs loaded**: `landing-page/spec.md`, `landing-page/context.md`, `landing-page/design.md`, `landing-page/tasks.md`, `CLAUDE.md`
**Findings**: 7 across 6 files

---

## SECURITY (1)

### `app/page.tsx`, `features/landing/components/money-preserved-section.tsx:2`, `features/landing/components/gamification-section.tsx:4` — Rota pública "/" arrasta client Supabase com service-role key (bypassa RLS)

`MoneyPreservedSection`/`GamificationSection` importam `MoneyPreservedCard`, `StatCard`, `XpProgressCard` do barrel `@/features/dashboard`. Esse barrel também reexporta `get-dashboard-data.ts`, que instancia `supabaseAdmin` (`lib/supabase/admin.ts`) no escopo do módulo — client com `SUPABASE_SERVICE_ROLE_KEY`, que bypassa RLS. O comentário no próprio arquivo é explícito: *"Only `features/sports-sync/services/*` may import this file. Never import from client-side code or other features."*

A landing (`/`, sem autenticação) agora arrasta esse client privilegiado pro grafo de import da rota mais exposta do app, só para reusar componentes visuais com dados mockados. Hoje é seguro em runtime (Server Component, chave não vaza pro browser, nenhuma seção da landing faz fetch de fato — confirmado pelo subagente de Performance), mas viola a fronteira de acesso documentada e aumenta o blast radius: qualquer refactor futuro que mova um desses componentes pro client bundle, ou rode em edge runtime, exporia o problema de forma muito mais grave. Os próprios testes novos precisam de `vi.mock("@/lib/supabase/admin", ...)` pra não instanciar o client de verdade — sintoma direto do acoplamento.

**Recomendação**: não reusar `StatCard`/`XpProgressCard`/`MoneyPreservedCard` direto do barrel `features/dashboard` na landing. Extrair esses 3 componentes puramente visuais para um módulo compartilhado sem dependência de `get-dashboard-data`/`supabaseAdmin` (ex.: `components/` ou uma sub-pasta de export que não passe pelo barrel principal do dashboard).

---

## CRITICAL (0)

Nenhum encontrado.

---

## PERFORMANCE (1)

### `features/landing/components/hero-section.tsx:22-29` — Aspect ratio da ilustração do Hero não bate com o arquivo real

`width={480} height={480}` (1:1) mas `public/bet-free-images/saved-illustration.png` é 1024x768 (4:3). Como o componente usa `priority` + `w-full h-auto`, o browser reserva o espaço errado até recalcular a partir da imagem carregada — reflow leve no LCP da página.

**Recomendação**: usar `width={1024} height={768}` (dimensões reais do arquivo).

---

## WARNING (0)

Nenhum encontrado.

---

## SUGGESTION (5)

### `bet-free-images/` duplicado na raiz do repo (untracked)
Existe uma cópia em `bet-free-images/` na raiz, além de `public/bet-free-images/` (a usada de fato pelo `next/image`). Apontado independentemente pelos subagentes de Requisitos, Regressão e Arquitetura. Provável resíduo de cópia manual do asset — remover antes do commit, manter só `public/bet-free-images/`.

### `tests/features/landing/components/final-cta-section.test.tsx` — falta assert do heading
Todas as outras seções testam texto/heading + elemento interativo; esse teste só verifica o link. Adicionar `expect(screen.getByRole("heading", ...))` para simetria.

### `tests/features/landing/components/how-it-works-section.test.tsx:11-19` — teste de ordem acoplado a texto exato
Usa `container.textContent.indexOf(...)`/regex para inferir ordem dos passos — frágil a qualquer rewording de copy. Apontado por Tests e Regression. Alternativa: `screen.getAllByRole("heading", { level: 3 })` e comparar ordem dos textos.

### Débito técnico: `vi.mock("@/lib/supabase/admin", ...)` como workaround em testes
Já é padrão estabelecido em ~20 arquivos de teste no repo (não introduzido por este diff), mas cada novo consumidor do barrel `@/features/dashboard` herda esse acoplamento. Não bloqueia este PR — mesma causa raiz do achado de Security acima; resolver na origem (lazy-init do client Supabase) resolveria ambos.

### `MOCK_LANDING_STATS` não exposto na API pública da feature + valores mockados divergem dos exemplos do design.md
`features/landing/index.ts` não reexporta `mock-stats.ts` (aceitável hoje, é só consumo interno). Os valores usados (`moneySaved: 487`, `level: 4`, etc.) diferem dos exemplos ilustrativos do design.md (`342`, `3`) — não é bug, exemplos eram ilustrativos, mas vale alinhar expectativa se o design.md for referência viva.

---

## Files With No Findings

- `lib/auth/middleware-logic.ts` — mudança exemplar, apenas destaque positivo
- `tests/lib/auth/middleware-logic.test.ts` — cobertura completa dos 4 quadrantes relevantes
- `vitest.config.mts` — ajuste correto e mínimo
- `features/landing/components/how-it-works-section.tsx`, `final-cta-section.tsx` — sem achados no componente em si

---

## Highlights

- **Security**: match exato (não prefixo) em `isPublicPath` — adicionar `/` a `PUBLIC_PATHS` não abriu nenhuma outra rota por engano; redirect pós-login corrigido de `/` para `/home` evita loop/exposição indevida.
- **Requirements**: todos os 6 acceptance criteria do spec.md em PASS, com evidência file:line; nenhum SPEC_DEVIATION encontrado.
- **Tests**: `middleware-logic.test.ts` cobre os 2 novos comportamentos com casos positivo e negativo sem quebrar nenhum teste existente.
- **Architecture**: `decideRedirect` generalizado exatamente conforme a Tech Decision do design.md, sem lógica solta ou caso esquecido.
- **Regression**: nenhuma deleção órfã, nenhum import fantasma — todos os símbolos importados foram verificados como existentes via grep.
- **Performance**: nenhuma seção da landing faz fetch escondido; middleware permanece O(1); LCP do Hero já usa `priority`.
