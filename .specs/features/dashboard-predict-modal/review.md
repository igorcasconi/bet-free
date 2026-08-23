# Review — Dashboard Predict Modal

**Modo:** Local (mudanças não commitadas na própria `main`, sem branch dedicada)
**Data:** 2026-08-23

## Resumo

| | |
|---|---|
| **Modo** | Local |
| **Escopo** | 12 arquivos alterados (10 modificados + 2 novos), 0 commits (working tree) |
| **Subagentes** | 6 de 6 — Security, Requirements, Tests, Architecture, Regression, Performance |
| **Docs carregados** | `dashboard-predict-modal/spec.md`, `dashboard-predict-modal/context.md`, `dashboard-predict-modal/tasks.md`, `CLAUDE.md` |
| **Achados** | 6 across 5 arquivos |

---

### SECURITY (1)

- `features/matches/index.ts:8` — Barrel público reexporta `services/_shared.ts`, que importa `lib/supabase/admin.ts` (server-only). O comentário do próprio `admin.ts` diz "Only `features/sports-sync/services/*` may import this file. Never import from client-side code or other features" — já violado antes desta feature, mas esta mudança **promove** esse módulo para a API pública da feature, expondo o risco a qualquer client component que use `@/features/matches` no futuro. A prova de que o risco é real: dois arquivos desta própria feature (`match-card.tsx`, `match-list-section-client.tsx`) tiveram que contornar o barrel com import interno (documentado como `SPEC_DEVIATION`) porque importar via barrel quebra em client-side (env var server-only lida em import-time). **Recomendação:** separar `toMatchCardData`/`MATCH_SELECT`/`MatchRow` (puros, sem I/O) de `resolveUserId` (usa `supabaseAdmin`) em módulos distintos; o barrel público reexporta só o módulo puro. Isso elimina a necessidade dos dois `SPEC_DEVIATION` na raiz, sem exigir disciplina manual em cada novo import.

### CRITICAL (0)

Nenhum.

### PERFORMANCE (2)

- ~~`features/dashboard/services/get-dashboard-data.ts` — a query de `users` deixou de rodar em paralelo com `getTodayAndUpcomingMatches`.~~ **CORRIGIDO.** `getTodayAndUpcomingMatches` foi separada em `fetchTodayAndUpcomingMatchRows` (busca bruta, sem depender de `userId`) + `toTodayAndUpcomingMatches` (mapeamento puro). `getDashboardData` agora roda `Promise.all([userQuery, fetchTodayAndUpcomingMatchRows()])` e só aplica `toMatchCardData` depois que ambas resolvem — paralelismo original restaurado. `tsc --noEmit` limpo, 110/110 testes passam.
- `features/matches/services/_shared.ts` (reaproveitado por `get-dashboard-data.ts`) — o `MATCH_SELECT` compartilhado inclui `predictions(...)` de **todos os usuários** por partida. O dashboard antes usava um select mais enxuto, sem esse relacionamento. Overhead de payload desnecessário se o volume de palpites por partida crescer — não bloqueante hoje, vale monitorar. (Não corrigido nesta rodada — trade-off de reuso vs. leveza de payload, decisão consciente.)

### WARNING (1)

- `features/dashboard/components/match-card.tsx` vs `features/matches/components/match-card.tsx` — as duas implementações são quase idênticas (mesmas props, mesmo `predictionStatusFor`, mesmo `PREDICTION_BADGE_LABEL`, mesma estrutura). Isso foi uma **decisão explícita do `/interview`** (manter identidade visual própria do dashboard em vez de reusar o componente de `matches` — ver `context.md`, seção "Componente card do dashboard"), então não é um erro de execução — mas registra-se como tech debt: se o barrel for corrigido (achado SECURITY acima), vale reavaliar se compensa unificar via prop de variante em vez de arquivo duplicado.

### SUGGESTION (2)

- `features/dashboard/components/match-card.tsx:13-16` e `features/matches/components/match-card.tsx:24-27` — `PREDICTION_BADGE_LABEL` duplicado literalmente nos dois arquivos; consequência direta do achado WARNING acima. Se resolvido, migraria para `features/matches/lib/prediction-status.ts` junto de `predictionStatusFor`.
- Gaps de teste (não bloqueantes, 110/110 testes passam):
  - `match-list-section-client.test.tsx` não testa explicitamente clicar num CTA de `upcomingMatches` (só testa via `todayMatches`); risco baixo já que `onPredict` é o mesmo callback nas duas seções.
  - `get-dashboard-data.test.ts` não cobre o caso de uma prediction de **outro usuário** (`user_id` diferente) devendo mapear `prediction: null` no nível de `getDashboardData` (a lógica em si já é testada em `toMatchCardData`, isolado).
  - `get-dashboard-data.test.ts` não cobre usuário anônimo (`firebaseUid: null`) com predictions presentes na fixture.
  - `match-card.test.tsx` (dashboard) não faz assert do texto do botão quando `status` é "locked" (só testa `disabled`).

---

### Arquivos sem achados

- `app/(app)/home/page.tsx` — troca de import/uso, sem lógica sensível.
- `features/dashboard/components/match-list-section.tsx` — passthrough de prop, presentation-only mantido.
- `features/dashboard/index.ts` — export novo segue padrão existente.
- `features/dashboard/types/index.ts` — remoção limpa de `DashboardMatch`, sem referências órfãs (confirmado via grep global).

---

### Destaques

- **Security:** `submitPrediction`/`upsertPrediction` (reaproveitados, não alterados) resolvem `userId` via sessão server-side e validam `status === "scheduled"` antes de gravar — nenhuma dessas proteções foi enfraquecida ao estender o fluxo ao dashboard.
- **Requirements:** todas as 6 acceptance criteria (DPM-01..06) e os 4 edge cases do spec.md estão implementados; `tasks.md` bate exatamente com o diff real (contagens de teste incluídas), zero scope creep.
- **Tests:** cobertura das mudanças centrais (badge/disabled/CTA/onPredict) é sólida; `predictionStatusFor` já tem teste dedicado cobrindo toda a matriz de status.
- **Architecture:** eliminação real de duplicação de query/mapeamento entre `dashboard` e `matches` (reuso de `MATCH_SELECT`/`toMatchCardData`) — exatamente o que "Domain First" pede.
- **Regression:** remoção de `DashboardMatch`/`toDashboardMatch`/`MATCH_SELECT` local feita sem deixar nenhuma referência órfã; nenhum phantom import nos novos exports de barrel.
