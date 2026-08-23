# Dashboard Predict Modal — Interview Decisions

**Date:** 2026-08-23
**Scope:** Conectar o botão "Palpitar" (hoje estático) do card de partida no dashboard (`features/dashboard/components/match-card.tsx`) ao fluxo de palpite já existente em `features/matches` (`PredictDialog` + `submitPrediction`).
**Source:** Informal discussion (bug fix de hydration na sessão anterior levou à descoberta do gap)

---

## Decisions

### Estado atual (achados da investigação)

- Modal de palpite já existe e funciona em `features/matches/components/predict-dialog.tsx`, usado por `features/matches/components/matches-page-content.tsx`.
- `features/dashboard/components/match-card.tsx:50-52` tem botão "Palpitar" sem `onClick`, puramente visual.
- `DashboardMatch` (`features/dashboard/types/index.ts:15-24`) não tem `competitionId`, `status`, nem `prediction` real — só `hasPrediction: false` hardcoded (`features/dashboard/services/get-dashboard-data.ts:51`).
- `app/(app)/home/page.tsx` → `MatchListSection` → `MatchCard` são todos Server Components hoje, sem client boundary.
- Não há precedente de import cross-feature entre `dashboard` e `matches`.

### Paridade funcional

- Paridade completa com o card de matches: badge "Sem palpite"/"Palpite feito" + botão `disabled` quando a partida já começou (`locked`).
- **Rationale:** consistência de produto; evita usuário tentar palpitar em partida já iniciada pelo dashboard.

### Modelo de dados

- `features/dashboard` passa a usar `MatchCardData` (de `features/matches`) no lugar de `DashboardMatch`.
- `get-dashboard-data.ts` passa a montar o mesmo shape, reaproveitando `toMatchCardData`/`MATCH_SELECT` de `features/matches/services/_shared.ts` (promovidos a API pública, ver abaixo).
- `DashboardMatch` e `toDashboardMatch` (hoje com `hasPrediction` hardcoded) são removidos/substituídos como parte dessa mudança.
- **Rationale:** elimina duplicação de tipo e mapeamento; evita divergência futura entre os dois shapes.

### Componente card do dashboard

- `features/dashboard/components/match-card.tsx` mantém seu layout/estilo próprio (compacto, botão verde) — **não** substitui pelo `MatchCard` de `features/matches`.
- Passa a receber `onPredict: (match: MatchCardData) => void`, calcular `predictionStatusFor` (importado de `features/matches`), e exibir badge/disabled do mesmo jeito que o card de matches.
- **Rationale:** preserva a identidade visual própria do dashboard, que é propositalmente mais enxuto; só a lógica é compartilhada.

### API pública de `features/matches`

- `features/matches/index.ts` passa a exportar também: `PredictDialog`, `useSubmitPrediction`, `submitPrediction` (action), `predictionStatusFor` (lib), além de `toMatchCardData`/`MATCH_SELECT` (de `_shared.ts`) necessários para `get-dashboard-data.ts` remontar o mesmo shape.
- `features/dashboard` importa tudo isso via `@/features/matches` — nunca de caminho de arquivo interno.
- **Rationale:** segue a convenção do CLAUDE.md ("Never import internal files directly from another feature"); manter tudo dentro de `features/matches` em vez de extrair para módulo `shared/` porque hoje só 2 features consomem — sem justificar abstração nova ainda.

### Client boundary

- Novo `features/dashboard/components/match-list-section-client.tsx` ("use client"), recebendo os grupos de matches já buscados pelo Server Component da página (`app/(app)/home/page.tsx`), guardando `selectedMatch: MatchCardData | null` e renderizando `MatchListSection` (agora client) + `PredictDialog`.
- O fetch de dados continua no Server Component da página; só a interação (abrir modal) vira client.
- **Rationale:** mesmo padrão já usado em `features/matches/components/matches-page-content.tsx`; mantém Server-first, só adiciona client boundary onde é estritamente necessário (regra do CLAUDE.md de arquitetura server-first).

### Refresh pós-submit

- Sem mudança em `use-submit-prediction.ts`: o `router.refresh()` já existente é suficiente para atualizar o card do dashboard (refaz `getDashboardData` no Server Component).
- Sem optimistic update local no dashboard.
- **Rationale:** simplicidade; mesmo comportamento já usado pela seção "Hoje" de matches, sem lógica duplicada.

---

## Agent's Discretion

Nenhuma área foi delegada como "you decide" — todas as decisões foram explicitamente resolvidas pelo usuário.

---

## Deferred Ideas

Nenhuma ideia fora de escopo surgiu durante a entrevista.

---

## Open Questions

Nenhuma pendência em aberto.
