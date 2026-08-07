# Landing Page Tasks

**Design**: `.specs/features/landing-page/design.md`
**Status**: Done

---

## Execution Plan

### Phase 1: Foundation (Sequential) — **Est. tokens**: ~35k
```
T1 (middleware) → (nada bloqueado por T1, exceto T9)
T2 (mock stats) → (bloqueia T5, T6)
```
T1 e T2 não dependem um do outro — podem rodar em paralelo, mas ambos precisam existir antes da Fase 2.

### Phase 2: Seções (Parallel OK) — **Est. tokens**: ~60k
```
        ┌→ T3 (Hero) ──────────┐
        ├→ T4 (Como funciona) ─┤
T1,T2 ──┼→ T5 (Dinheiro Poup.) ─┼──→ T8
        ├→ T6 (Gamificação) ───┤
        └→ T7 (CTA final) ─────┘
```

### Phase 3: Integração (Sequential) — **Est. tokens**: ~25k
```
T8 (index.ts) → T9 (app/page.tsx) → T10 (verificação final)
```

---

## Task Breakdown

### T1: Ajustar middleware para rota pública `/` com redirect condicional

**What**: Adicionar `"/"` a `PUBLIC_PATHS` e generalizar `decideRedirect` para que rota pública + sessão válida redirecione para `/home` (em vez de `"/"` fixo).
**Where**: `lib/auth/middleware-logic.ts`
**Depends on**: None
**Reuses**: estrutura existente de `decideRedirect`/`isPublicPath`
**Requirement**: LAND-01

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `isPublicPath("/")` retorna `true`
- [x] `decideRedirect({ pathname: "/", hasValidSession: false })` → `{ action: "next" }`
- [x] `decideRedirect({ pathname: "/", hasValidSession: true })` → `{ action: "redirect", to: "/home" }`
- [x] `decideRedirect({ pathname: "/login", hasValidSession: true })` → `{ action: "redirect", to: "/home" }` (teste existente atualizado)
- [x] Gate check passa: `npm run test -- middleware-logic && npm run lint`
- [x] Contagem de testes: 6+ testes passam (4 existentes atualizados/mantidos + 2 novos para `/`)

**Tests**: unit (`tests/lib/auth/middleware-logic.test.ts`)
**Gate**: quick

---

### T2: Criar constantes de dados mockados da landing

**What**: Criar `MOCK_LANDING_STATS` com valores estáticos (moneySaved, level, xpInLevel, xpToNextLevel, currentStreak, accuracyPercent).
**Where**: `features/landing/constants/mock-stats.ts`
**Depends on**: None
**Reuses**: formato espelha `DashboardStats` (`features/dashboard/types.ts`) apenas para compatibilidade de props
**Requirement**: LAND-04, LAND-05

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Constante exportada com todos os campos usados pelos cards reaproveitados
- [x] Tipos batem com as props de `MoneyPreservedCard`, `XpProgressCard`, `StatCard`
- [x] Gate check passa: `npm run lint`

**Tests**: none (dado estático, sem lógica)
**Gate**: quick

---

### T3: Criar `HeroSection` [P]

**What**: Componente com headline, subheadline, ilustração (`bet-free-images/saved-illustration.png`) e CTA principal para `/login`.
**Where**: `features/landing/components/hero-section.tsx`
**Depends on**: None
**Reuses**: `components/ui/button.tsx`, `next/image`
**Requirement**: LAND-02

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Renderiza headline, subheadline e imagem com `alt` descritivo
- [x] CTA usa `Button asChild` + `Link href="/login"`
- [x] Gate check passa: `npm run test -- hero-section && npm run lint`
- [x] Contagem de testes: 2+ testes passam (headline visível, CTA aponta pra `/login`)

**Tests**: unit (RTL render)
**Gate**: quick

---

### T4: Criar `HowItWorksSection` [P]

**What**: Componente com os 3 passos (palpite grátis → XP/streak → dinheiro preservado), usando `Card` + ícones `lucide-react`.
**Where**: `features/landing/components/how-it-works-section.tsx`
**Depends on**: None
**Reuses**: `components/ui/card.tsx`
**Requirement**: LAND-03

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Renderiza os 3 passos na ordem definida no spec
- [x] Gate check passa: `npm run test -- how-it-works-section && npm run lint`
- [x] Contagem de testes: 1+ teste passa (3 passos presentes na ordem)

**Tests**: unit (RTL render)
**Gate**: quick

---

### T5: Criar `MoneyPreservedSection` [P]

**What**: Componente que renderiza `MoneyPreservedCard` com `amount` de `MOCK_LANDING_STATS.moneySaved`.
**Where**: `features/landing/components/money-preserved-section.tsx`
**Depends on**: T2
**Reuses**: `MoneyPreservedCard` (`@/features/dashboard`)
**Requirement**: LAND-04

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Renderiza `MoneyPreservedCard` com valor mockado formatado em BRL
- [x] Gate check passa: `npm run test -- money-preserved-section && npm run lint`
- [x] Contagem de testes: 1+ teste passa

**Tests**: unit (RTL render)
**Gate**: quick

---

### T6: Criar `GamificationSection` [P]

**What**: Componente que renderiza `XpProgressCard` e `StatCard`s (streak, precisão) com dados de `MOCK_LANDING_STATS`.
**Where**: `features/landing/components/gamification-section.tsx`
**Depends on**: T2
**Reuses**: `XpProgressCard`, `StatCard` (`@/features/dashboard`)
**Requirement**: LAND-05

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Renderiza `XpProgressCard` com nível/XP mockados
- [x] Renderiza `StatCard`s de streak e precisão mockados
- [x] Gate check passa: `npm run test -- gamification-section && npm run lint`
- [x] Contagem de testes: 2+ testes passam

**Tests**: unit (RTL render)
**Gate**: quick

---

### T7: Criar `FinalCtaSection` [P]

**What**: Segundo CTA idêntico ("Acessar a plataforma") antes do rodapé, apontando para `/login`.
**Where**: `features/landing/components/final-cta-section.tsx`
**Depends on**: None
**Reuses**: `components/ui/button.tsx`
**Requirement**: LAND-06

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Renderiza CTA "Acessar a plataforma" com `Link href="/login"`
- [x] Gate check passa: `npm run test -- final-cta-section && npm run lint`
- [x] Contagem de testes: 1+ teste passa

**Tests**: unit (RTL render)
**Gate**: quick

---

### T8: Criar API pública da feature `landing`

**What**: Criar `index.ts` exportando as 5 seções (padrão feature-first do projeto).
**Where**: `features/landing/index.ts`
**Depends on**: T3, T4, T5, T6, T7
**Reuses**: N/A (arquivo de barril)
**Requirement**: LAND-02, LAND-03, LAND-04, LAND-05, LAND-06

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `index.ts` exporta `HeroSection`, `HowItWorksSection`, `MoneyPreservedSection`, `GamificationSection`, `FinalCtaSection`
- [x] Gate check passa: `npm run lint`

**Tests**: none (arquivo de barril, sem lógica)
**Gate**: quick

---

### T9: Substituir `app/page.tsx` pela composição da landing

**What**: Remover placeholder atual (`"Logado como {email}"` + `LogoutButton`) e compor as 5 seções via `@/features/landing`.
**Where**: `app/page.tsx`
**Depends on**: T1, T8
**Reuses**: `@/features/landing` (API pública de T8)
**Requirement**: LAND-01, LAND-02, LAND-03, LAND-04, LAND-05, LAND-06

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `app/page.tsx` é Server Component (sem `"use client"`), sem referência a `useAuth`/`LogoutButton`
- [x] Renderiza as 5 seções na ordem: Hero → Como funciona → Dinheiro Poupado → Gamificação → CTA final
- [x] Gate check passa: `npm run build && npm run lint`

**Tests**: none (composição pura — cobertura já está nas seções individuais)
**Gate**: full

---

### T10: Verificação final end-to-end

**What**: Rodar suíte completa, checar rotas manualmente (visitante anônimo vê landing em `/`; usuário logado é redirecionado pra `/home`; ambos os CTAs levam a `/login`).
**Where**: N/A (verificação, não código novo)
**Depends on**: T9
**Reuses**: N/A
**Requirement**: LAND-01 até LAND-06 (todos)

**Tools**:
- MCP: NONE
- Skill: NONE (usar `/run` se disponível pra abrir o dev server e conferir visualmente)

**Done when**:
- [x] `npm run test` passa (suíte completa, sem regressões)
- [x] `npm run lint` passa
- [x] `npm run build` passa
- [x] Verificação manual: `/` anônimo renderiza landing; `/` autenticado redireciona pra `/home`; ambos CTAs navegam pra `/login`
- [x] Todos os Success Criteria do spec.md marcados como atendidos

**Tests**: full suite (regressão)
**Gate**: full

---

## Requirement Traceability (atualização aplicada em spec.md)

| Requirement ID | Tasks              |
| --------------- | ------------------- |
| LAND-01         | T1, T9, T10          |
| LAND-02         | T3, T8, T9, T10       |
| LAND-03         | T4, T8, T9, T10       |
| LAND-04         | T2, T5, T8, T9, T10   |
| LAND-05         | T2, T6, T8, T9, T10   |
| LAND-06         | T7, T8, T9, T10       |
