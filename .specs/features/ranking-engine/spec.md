# Ranking Engine Specification

## Problem Statement

O app calcula e persiste dados individuais de gamificação por usuário (`users.money_saved`, `xp`, `level`, `current_streak`, `predictions.points_earned`) via `features/prediction-processing`, mas não existe nenhuma visão comparativa entre usuários. A página `/rankings` é hoje um placeholder ("Em breve") e a tabela `ranking_cache` existe no schema desde o início do projeto sem nunca ter sido populada. Sem rankings, a competição social — um dos pilares de engajamento do produto — não existe.

## Proposed Solution

Um `RankingEngine` recalcula periodicamente (via cron, logo após o `PredictionProcessor`) três rankings — Accuracy, Discipline e Money Saved — e os persiste em `ranking_cache`, para que leituras futuras (ex: a página de rankings) sejam simples SELECTs ordenados por `position`, sem nunca recalcular sob demanda.

## Goals

- [x] `ranking_cache` reflete, após cada execução, a posição de cada usuário elegível nos 3 rankings (geral, sem escopo por competição)
- [x] Nenhuma leitura de ranking dispara cálculo — toda leitura é servida do cache já populado
- [x] Recálculo pode ser disparado repetidamente (cron) sem duplicar linhas nem correr em paralelo consigo mesmo

## Out of Scope

| Feature                                                                          | Reason                                                                                 |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Ranking por competição (`competition_id` preenchido)                             | Deferred na interview — schema já suporta, implementação adiada                        |
| Recálculo incremental                                                            | Deferred na interview — prematuro sem dado de volume real                              |
| Desempate por accuracy no Money Saved (ou qualquer regra cruzada entre rankings) | Descartado na interview a favor de desempate técnico (`id`)                            |
| UI da página `/rankings`                                                         | Fora do escopo desta feature — apenas o cálculo/cache; consumo por UI é feature futura |
| Rebalancear fórmulas de XP/level/money_saved/streak                              | Já definidas em `.specs/features/prediction-processor/` — não reabertas aqui           |

---

## User Stories

### P1: Calcular e cachear Accuracy Ranking ⭐ MVP

**User Story**: Como usuário que faz previsões, quero ver minha posição comparada a outros usuários por taxa de acerto, para saber se sou bom em prever resultados.

**Why P1**: Um dos 3 rankings pedidos explicitamente; base para engajamento social.

**Acceptance Criteria**:

1. WHEN um usuário tem 5 ou mais previsões com `points_earned IS NOT NULL` THEN o sistema SHALL calcular sua accuracy como `acertos / total_processadas` e gravar uma linha em `ranking_cache` com `ranking_type = 'accuracy'`, `competition_id = NULL`
2. WHEN um usuário tem menos de 5 previsões processadas THEN o sistema SHALL não gravar (ou remover, se existia de execução anterior) sua linha de `ranking_type = 'accuracy'`
3. WHEN duas ou mais usuários têm a mesma accuracy THEN o sistema SHALL desempatar por `id` do usuário de forma determinística
4. WHEN o ranking é recalculado THEN o sistema SHALL gravar `position` sequencial (1 = melhor accuracy) para todos os usuários elegíveis

**Independent Test**: Popular usuários com diferentes contagens/taxas de previsões processadas; rodar o processor; verificar `ranking_cache` contém exatamente os usuários com 5+ previsões, ordenados corretamente por accuracy, com `position` sequencial.

---

### P1: Calcular e cachear Discipline Ranking ⭐ MVP

**User Story**: Como usuário, quero ver minha posição comparada a outros por quantos dias evitei apostar dinheiro real, para reforçar meu progresso na jornada "bet-free".

**Why P1**: Um dos 3 rankings pedidos explicitamente; usa métrica já existente (`current_streak`).

**Acceptance Criteria**:

1. WHEN o ranking é recalculado THEN o sistema SHALL ordenar todos os usuários por `users.current_streak` desc e gravar `ranking_type = 'discipline'`, `competition_id = NULL` com `position` sequencial
2. WHEN dois usuários têm o mesmo `current_streak` THEN o sistema SHALL desempatar por `id`
3. WHEN um usuário tem `current_streak = 0` THEN o sistema SHALL incluí-lo no ranking normalmente (sem mínimo de elegibilidade)

**Independent Test**: Popular usuários com streaks variados incluindo 0; rodar o processor; verificar ordenação e inclusão de todos.

---

### P1: Calcular e cachear Money Saved Ranking ⭐ MVP

**User Story**: Como usuário, quero ver minha posição comparada a outros por quanto dinheiro "economizei" não apostando de verdade, para reforçar a proposta de valor do app.

**Why P1**: Um dos 3 rankings pedidos explicitamente.

**Acceptance Criteria**:

1. WHEN o ranking é recalculado THEN o sistema SHALL ordenar todos os usuários por `users.money_saved` desc e gravar `ranking_type = 'money_saved'`, `competition_id = NULL` com `position` sequencial
2. WHEN dois usuários têm o mesmo `money_saved` THEN o sistema SHALL desempatar por `id`
3. WHEN um usuário tem `money_saved = 0` THEN o sistema SHALL incluí-lo no ranking normalmente (sem mínimo de elegibilidade)

**Independent Test**: Popular usuários com valores variados incluindo 0 e empates; rodar o processor; verificar ordenação e desempate.

---

### P1: Endpoint de recálculo idempotente e protegido ⭐ MVP

**User Story**: Como sistema de automação (cron do GitHub Actions), quero disparar o recálculo dos 3 rankings via rota HTTP segura e sem condição de corrida, logo após o processamento de previsões, para manter os rankings atualizados sem recalcular a cada leitura.

**Why P1**: Sem trigger protegido, o cache nunca é populado em produção.

**Acceptance Criteria**:

1. WHEN uma requisição `POST /api/rankings/process` chega sem header `x-sync-secret` válido THEN o sistema SHALL retornar 401 sem processar nada
2. WHEN uma requisição válida chega enquanto outra execução do tipo `'rankings'` já está em andamento (via `withSyncLock`) THEN o sistema SHALL rejeitar com 409
3. WHEN a rota é executada com sucesso THEN o sistema SHALL recalcular os 3 rankings do zero (full recompute, não incremental) em uma única execução
4. WHEN a execução termina (sucesso ou erro) THEN o sistema SHALL liberar o lock em `sync_runs`, permitindo a próxima execução agendada

**Independent Test**: Chamar a rota sem secret (falha), com secret válido (sucesso), e disparar duas chamadas concorrentes (segunda falha por lock).

---

## Edge Cases

- WHEN não existe nenhum usuário elegível para um ranking (ex: base vazia) THEN o sistema SHALL retornar sucesso (200) processando zero linhas para aquele ranking, sem erro
- WHEN um usuário estava no ranking de accuracy em uma execução anterior mas caiu abaixo do mínimo de 5 previsões (não deveria acontecer na prática, já que `points_earned` só é setado, nunca desfeito — mas o full recompute deve ser correto de qualquer forma) THEN o sistema SHALL remover sua linha antiga de `ranking_type = 'accuracy'`
- WHEN um usuário existe em `users` mas nunca fez nenhuma previsão THEN o sistema SHALL incluí-lo em Discipline (`current_streak = 0`) e Money Saved (`money_saved = 0`), mas não em Accuracy (0 previsões processadas < 5)
- WHEN o recálculo de um ranking falha (erro de banco) THEN o sistema SHALL propagar o erro, `withSyncLock` marca a execução como `failed`, e a rota retorna 500 — o cron tenta novamente no próximo ciclo

---

## Requirement Traceability

| Requirement ID | Story                                             | Phase  | Status  |
| -------------- | ------------------------------------------------- | ------ | ------- |
| RANK-01        | P1: Calcular e cachear Accuracy Ranking           | In Tasks | Done     |
| RANK-02        | P1: Calcular e cachear Discipline Ranking         | In Tasks | Done     |
| RANK-03        | P1: Calcular e cachear Money Saved Ranking        | In Tasks | Done     |
| RANK-04        | P1: Endpoint de recálculo idempotente e protegido | In Tasks | Done     |

**Coverage:** 4 total, 4 mapped to tasks, 0 unmapped

---

## Success Criteria

- [x] Rodar o recálculo duas vezes seguidas sobre o mesmo conjunto de dados produz o mesmo estado final em `ranking_cache` (idempotência do full recompute)
- [x] `ranking_cache` contém exatamente os usuários elegíveis para cada `ranking_type`, com `position` sequencial e desempate determinístico
- [x] Rota rejeita chamadas sem secret válido e rejeita execução concorrente
