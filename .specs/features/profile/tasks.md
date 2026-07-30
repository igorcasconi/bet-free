# Profile Tasks

**Design**: inline (Medium scope — sem design.md separado, decisões em `.specs/features/profile/context.md`)
**Status**: Done

**Nota sobre testes**: não existe `.specs/codebase/TESTING.md`. Convenção inferida do código existente: Vitest, `vi.mock("@/lib/supabase/admin")` com o padrão de query-builder chainable de `tests/features/dashboard/services/get-dashboard-data.test.ts` para services; Testing Library + ambiente jsdom para componentes (`tests/features/dashboard/components/**` já está na lista `JSDOM_GLOBS` de `vitest.config.mts` — `tests/features/profile/components/**` precisa ser adicionada, feito na T5). Comando `npx vitest run <path>`.

---

## Execution Plan

### Phase 1: Foundation (Parallel OK) — **Est. tokens**: ~35k

```
T1 (extrai accuracy + exporta getLatestPredictions) ─┐
T2 (types) ─┴─→ (nada bloqueado entre si)
```

### Phase 2: Serviço de achievements + componentes (Parallel OK) — **Est. tokens**: ~45k

```
T2 ──→ T3 (get-user-achievements)
T2 ──→ T5 (profile-header)
T2 ──→ T6 (achievements-section)
```

### Phase 3: Orquestrador (Sequential) — **Est. tokens**: ~30k

```
T1,T2,T3 ──→ T4 (get-profile-data)
```

### Phase 4: Barrel + página (Sequential) — **Est. tokens**: ~20k

```
T4,T5,T6 ──→ T7 (index.ts) ──→ T8 (page.tsx)
```

---

## Task Breakdown

### T1: Extrair `getAccuracyPercent` + exportar `getLatestPredictions`

**What**: Mover `getAccuracyPercent` de `features/dashboard/services/get-dashboard-data.ts` para `lib/predictions/accuracy.ts` (nova função exportada, mesma lógica); atualizar `get-dashboard-data.ts` para importar dali; adicionar `export` em `getLatestPredictions` no mesmo arquivo (já é reexportada automaticamente pelo barrel `features/dashboard/index.ts` via `export * from "./services/get-dashboard-data"`).
**Where**: `lib/predictions/accuracy.ts` (novo), `features/dashboard/services/get-dashboard-data.ts` (modificado)
**Depends on**: None
**Reuses**: Lógica exata hoje em `get-dashboard-data.ts` (query `predictions` filtrando `points_earned IS NOT NULL`)
**Requirement**: PROF-02

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `lib/predictions/accuracy.ts` exporta `getAccuracyPercent(userId: string): Promise<number>` com a lógica idêntica à removida
- [x] `get-dashboard-data.ts` importa e usa `getAccuracyPercent` de `@/lib/predictions/accuracy`, sem lógica duplicada
- [x] `getLatestPredictions` agora é `export`ada (acessível via `@/features/dashboard`)
- [x] Teste existente `tests/features/dashboard/services/get-dashboard-data.test.ts` atualizado para mockar `@/lib/predictions/accuracy` em vez do mock de tabela `predictions` para accuracy, e continua passando sem mudança de comportamento observável
- [x] Novo teste `tests/lib/predictions/accuracy.test.ts`
- [x] Gate check passa: `npx vitest run tests/lib/predictions/accuracy.test.ts tests/features/dashboard/services/get-dashboard-data.test.ts`
- [x] Test count: 4+ testes novos em accuracy.test.ts, testes existentes de dashboard continuam 100% passando

**Tests**: unit
**Gate**: quick

---

### T2: `features/profile/types/index.ts`

**What**: Definir `ProfileIdentity`, `ProfileAchievement`, `ProfileData`.
**Where**: `features/profile/types/index.ts`
**Depends on**: None
**Reuses**: `DashboardPrediction` (importado de `@/features/dashboard` para compor `ProfileData.latestPredictions`)
**Requirement**: PROF-01, PROF-02, PROF-03, PROF-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `ProfileIdentity { displayName: string | null; email: string | null; avatarUrl: string | null }`
- [x] `ProfileAchievement { id: string; name: string; description: string | null; iconUrl: string | null; earnedAt: string }`
- [x] `ProfileData { identity: ProfileIdentity; stats: {...igual a DashboardData["stats"]}; achievements: ProfileAchievement[]; latestPredictions: DashboardPrediction[] }`
- [x] `tsc --noEmit` sem erros

**Tests**: none (apenas tipos)
**Gate**: build

---

### T3: `features/profile/services/get-user-achievements.ts` [P]

**What**: `getUserAchievements(userId: string): Promise<ProfileAchievement[]>` — query real em `user_achievements` join `achievements`, ordenada por `earned_at desc`.
**Where**: `features/profile/services/get-user-achievements.ts`
**Depends on**: T2
**Reuses**: Padrão de query/mapeamento de `get-dashboard-data.ts` (`getLatestPredictions`)
**Requirement**: PROF-03

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Query `user_achievements` com `.select("earned_at, achievements(id, name, description, icon_url)")`, `.eq("user_id", userId)`, `.order("earned_at", {ascending: false})`
- [x] Retorna `[]` quando não há linhas (caso real hoje, sempre)
- [x] Mapeia corretamente linhas quando existirem (preparado para o futuro, mesmo sem seed hoje)
- [x] Gate check passa: `npx vitest run tests/features/profile/services/get-user-achievements.test.ts`
- [x] Test count: 3+ testes passam (vazio, com linhas, erro do supabase propaga)

**Tests**: unit
**Gate**: quick

---

### T4: `features/profile/services/get-profile-data.ts`

**What**: Orquestrador `getProfileData(firebaseUid: string | null): Promise<ProfileData>` — resolve usuário por `firebase_uid`, monta stats (mesmo padrão do dashboard), busca achievements e últimas previsões em paralelo.
**Where**: `features/profile/services/get-profile-data.ts`
**Depends on**: T1, T2, T3
**Reuses**: `lib/gamification.ts` (`levelForXp`, `xpInLevelForXp`, `XP_THRESHOLD`), `lib/predictions/accuracy.ts` (`getAccuracyPercent`), `getLatestPredictions` de `@/features/dashboard`, `get-user-achievements.ts`
**Requirement**: PROF-01, PROF-02, PROF-03, PROF-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `firebaseUid = null` OU usuário não encontrado → retorna `ProfileData` com `identity` toda `null`, stats zerados (mesmo padrão de `zeroStats()` do dashboard), `achievements: []`, `latestPredictions: []`
- [x] Usuário encontrado → busca `id, display_name, avatar_url, email, money_saved, current_streak, xp`; `stats.level`/`xpInLevel` via `levelForXp`/`xpInLevelForXp` (nunca lê `users.level` direto); `stats.accuracyPercent` via `getAccuracyPercent`; `achievements` via `getUserAchievements`; `latestPredictions` via `getLatestPredictions`
- [x] As 3 buscas paralelas (`Promise.all`) após resolver o usuário
- [x] Gate check passa: `npx vitest run tests/features/profile/services/get-profile-data.test.ts`
- [x] Test count: 5+ testes passam (usuário não encontrado, firebaseUid null, usuário completo, campos de identidade NULL, erro de query propaga)

**Tests**: unit
**Gate**: quick

---

### T5: `features/profile/components/profile-header.tsx` [P]

**What**: Componente de cabeçalho — avatar (com `AvatarImage`/`AvatarFallback` de iniciais), nome e email, com fallbacks graciosos quando campos são `null`.
**Where**: `features/profile/components/profile-header.tsx`
**Depends on**: T2
**Reuses**: `components/ui/avatar.tsx` (`Avatar`, `AvatarImage`, `AvatarFallback`, `size="lg"`)
**Requirement**: PROF-01

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `avatarUrl` presente → `AvatarImage` renderizada
- [x] `avatarUrl` ausente, `displayName` presente → `AvatarFallback` com iniciais (até 2 letras, primeira letra de até 2 palavras)
- [x] `displayName` ausente → nome exibido como "Usuário", fallback de avatar genérico (`?` ou iniciais neutras)
- [x] `email` ausente → linha de email não renderizada (não mostra vazio)
- [x] Adicionar `"tests/features/profile/components/**"` à lista `JSDOM_GLOBS` em `vitest.config.mts` (necessário para este e o próximo teste de componente rodarem em ambiente jsdom)
- [x] Gate check passa: `npx vitest run tests/features/profile/components/profile-header.test.tsx`
- [x] Test count: 4+ testes passam (os 4 casos acima)

**Tests**: unit (Testing Library, jsdom)
**Gate**: quick

---

### T6: `features/profile/components/achievements-section.tsx` [P]

**What**: Seção de achievements — empty-state quando vazio, grid de cards quando houver dados (preparado para o futuro).
**Where**: `features/profile/components/achievements-section.tsx`
**Depends on**: T2
**Reuses**: Padrão visual de empty-state de `features/dashboard/components/latest-predictions-section.tsx` (`Card` centralizado com mensagem)
**Requirement**: PROF-03

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Lista vazia → `Card` com mensagem "Nenhuma conquista ainda"
- [x] Lista com itens → grid de cards (`sm:grid-cols-2 lg:grid-cols-3`) exibindo nome/descrição de cada achievement
- [x] Gate check passa: `npx vitest run tests/features/profile/components/achievements-section.test.tsx`
- [x] Test count: 3+ testes passam (vazio, com 1 item, com múltiplos itens)

**Tests**: unit (Testing Library, jsdom — já coberto pelo JSDOM_GLOBS adicionado na T5)
**Gate**: quick

---

### T7: `features/profile/index.ts`

**What**: Barrel de API pública do feature.
**Where**: `features/profile/index.ts`
**Depends on**: T4, T5, T6
**Reuses**: Padrão de `features/dashboard/index.ts`
**Requirement**: PROF-01, PROF-02, PROF-03, PROF-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Exporta `getProfileData`, tipos de `./types`, `ProfileHeader`, `AchievementsSection`
- [x] `tsc --noEmit` sem erros

**Tests**: none (barrel)
**Gate**: build

---

### T8: `app/(app)/profile/page.tsx`

**What**: Substituir a página placeholder por composição real: `ProfileHeader`, `MoneyPreservedCard`, grid de `StatCard` (Level, Accuracy, Current Streak), `XpProgressCard`, `AchievementsSection`, `LatestPredictionsSection`.
**Where**: `app/(app)/profile/page.tsx`
**Depends on**: T7
**Reuses**: `getCurrentFirebaseUid` (`lib/auth/get-current-user.ts`), `MoneyPreservedCard`/`StatCard`/`XpProgressCard`/`LatestPredictionsSection` de `@/features/dashboard`, `ProfileHeader`/`AchievementsSection`/`getProfileData` de `@/features/profile` — mesmo padrão de composição de `app/(app)/home/page.tsx`
**Requirement**: PROF-01, PROF-02, PROF-03, PROF-04, PROF-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Server Component `async function ProfilePage()`, sem placeholder "Em breve"
- [x] Estrutura `flex flex-col gap-6 p-6` (mesmo padrão do dashboard), grid `sm:grid-cols-3` para os 3 stat cards
- [x] Todas as seções compostas na ordem: identidade → money saved → stats → xp progress → achievements → recent predictions
- [x] Sem teste dedicado de página (convenção do projeto — nenhuma página tem teste próprio, ex: `app/(app)/home/page.tsx`); verificação é via `npx tsc --noEmit` e revisão manual/visual
- [x] `npx tsc --noEmit` sem erros

**Tests**: none (página, sem precedente de teste no projeto)
**Gate**: build

---

## Task Verification Standards

Todas as tarefas seguem o padrão de teste inferido: Vitest, `vi.mock("@/lib/supabase/admin")` com query-builder chainable (services), Testing Library + jsdom (componentes), comando `npx vitest run <path>`.

---

## Requirement Traceability Coverage

PROF-01 a PROF-05 mapeados nas tarefas acima (ver campo `Requirement` de cada task). `spec.md` será atualizado após aprovação deste documento.
