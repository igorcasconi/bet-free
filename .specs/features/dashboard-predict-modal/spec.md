# Dashboard Predict Modal Specification

## Problem Statement

O card de partida na home (`features/dashboard`) tem um botão "Palpitar" puramente visual — sem `onClick`, sem modal, sem submissão. O usuário só consegue de fato registrar um palpite navegando até a página de Matches, onde esse fluxo já existe (`PredictDialog` + `submitPrediction`). Isso força um passo extra desnecessário para uma ação que a home já promete visualmente.

## Proposed Solution

Conectar o botão "Palpitar" do card do dashboard ao mesmo fluxo de palpite já existente em `features/matches`: abrir o `PredictDialog`, submeter via `submitPrediction`, e refletir o resultado (badge de status, bloqueio de partida já iniciada) igual ao card de Matches. Nenhum modal novo é criado — reaproveita-se o que já existe, promovido à API pública de `features/matches`.

## Goals

- [x] Usuário registra um palpite direto da home, sem sair do dashboard
- [x] Card do dashboard reflete o mesmo estado de palpite (feito/não feito/bloqueado) que o card de Matches
- [x] Nenhuma duplicação de modal, action ou lógica de status de palpite entre as duas features

## Out of Scope

| Feature                                                        | Reason                                                                 |
| --------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Optimistic update local no card do dashboard antes do refresh   | Decidido no /interview: `router.refresh()` já existente é suficiente ([[dashboard-predict-modal/context]]) |
| Unificar visual do card do dashboard com o card de Matches       | Decidido manter identidade visual própria do dashboard                |
| Extrair PredictDialog/hook/action para módulo `shared/`          | Só 2 features consomem hoje — não justifica abstração nova ainda      |
| Campo de valor apostado (`wagered_amount`) no modal              | Coluna existe no schema mas `PredictDialog` atual não expõe esse campo — fora do escopo desta mudança |

---

## User Stories

### P1: Fazer palpite direto do card da home ⭐ MVP

**User Story**: Como usuário logado, quero clicar em "Palpitar" no card de uma partida na home e registrar meu palpite ali mesmo, para não precisar navegar até a página de Matches.

**Why P1**: É a única entrega desta feature — vertical slice completo (dado → UI → submissão → refresh).

**Acceptance Criteria**:

1. WHEN o usuário clica em "Palpitar" num card de partida agendada (`status = "scheduled"`) na home THEN o sistema SHALL abrir o `PredictDialog` (mesmo componente de `features/matches`) pré-preenchido com o palpite existente, se houver.
2. WHEN o usuário confirma o placar no modal THEN o sistema SHALL chamar `submitPrediction` (a mesma Server Action de `features/matches`) e, em caso de sucesso, fechar o modal e disparar `router.refresh()`.
3. WHEN o `router.refresh()` completa THEN o sistema SHALL exibir o card da home com o placar recém-salvo refletido (via nova chamada a `getDashboardData`).
4. WHEN a partida já possui `status` diferente de `"scheduled"` (ao vivo, encerrada, adiada, cancelada) THEN o sistema SHALL exibir o botão "Palpitar" desabilitado no card da home, igual ao comportamento do card de Matches.
5. WHEN a partida já tem um palpite registrado para o usuário THEN o card SHALL exibir o rótulo "Editar palpite" e o badge "Palpite feito", em vez de "Palpitar" e "Sem palpite".
6. WHEN a submissão falhar (ex: partida começou entre abrir o modal e confirmar) THEN o sistema SHALL exibir a mensagem de erro retornada por `submitPrediction` sem fechar o modal, mantendo o valor digitado.

**Independent Test**: Na home, abrir uma partida agendada sem palpite → clicar "Palpitar" → preencher placar → confirmar → ver card atualizado com "Editar palpite" e badge "Palpite feito", sem sair da página.

---

## Edge Cases

- WHEN não há client boundary hoje entre `page.tsx` e `MatchCard` THEN o sistema SHALL introduzir um novo client component (`match-list-section-client.tsx`) apenas para hospedar o estado do dialog selecionado, mantendo o fetch de dados no Server Component.
- WHEN `features/dashboard` migra de `DashboardMatch` para `MatchCardData` THEN o sistema SHALL remover o tipo `DashboardMatch` e a função `toDashboardMatch` (hoje com `hasPrediction` hardcoded em `false`) para não deixar código morto/divergente.
- WHEN `get-dashboard-data.ts` monta o novo shape THEN o sistema SHALL reaproveitar `toMatchCardData`/`MATCH_SELECT` de `features/matches` (promovidos à API pública) em vez de duplicar a query/mapeamento.
- WHEN outra feature (não `dashboard`) precisar do `PredictDialog`/`submitPrediction`/`useSubmitPrediction`/`predictionStatusFor` no futuro THEN esses SHALL continuar acessíveis apenas via `@/features/matches` (barrel `index.ts`), nunca por caminho de arquivo interno.

---

## Requirement Traceability

| Requirement ID | Story                                  | Phase     | Status    |
| -------------- | --------------------------------------- | --------- | --------- |
| DPM-01         | P1: Fazer palpite direto do card da home | In Tasks | Done |
| DPM-02         | P1: Fazer palpite direto do card da home | In Tasks | Done |
| DPM-03         | P1: Fazer palpite direto do card da home | In Tasks | Done |
| DPM-04         | P1: Fazer palpite direto do card da home | In Tasks | Done |
| DPM-05         | P1: Fazer palpite direto do card da home | In Tasks | Done |
| DPM-06         | P1: Fazer palpite direto do card da home | In Tasks | Done |

**Coverage:** 6 total, 6 mapped to tasks, 0 unmapped

---

## Success Criteria

- [x] Botão "Palpitar" da home abre o `PredictDialog` e submete corretamente
- [x] Card da home mostra badge de status do palpite e desabilita quando a partida trava
- [x] `DashboardMatch`/`toDashboardMatch` removidos; dashboard usa `MatchCardData`
- [x] `features/matches/index.ts` exporta `PredictDialog`, `useSubmitPrediction`, `submitPrediction`, `predictionStatusFor`, `toMatchCardData`, `MATCH_SELECT`
