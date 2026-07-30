# PredictionProcessor Specification

## Problem Statement

Partidas são sincronizadas e marcadas como `finished` (via `features/sports-sync`), mas nenhuma previsão (`predictions`) é avaliada depois disso: `points_earned` nunca é escrito, e as colunas de gamificação em `users` (`money_saved`, `xp`, `level`, `current_streak`) permanecem sempre no valor default. O dashboard já lê esses campos e já assume fórmulas de cálculo (ex: `level = floor(xp/3000)+1`), mas nada os popula. Sem essa peça, a proposta de valor do app (mostrar que apostar "de brincadeira" é melhor que apostar dinheiro real) fica sem dados reais.

## Proposed Solution

Um `PredictionProcessor` roda periodicamente (via cron externo do GitHub Actions, logo após a sincronização de partidas finalizadas) através de uma rota HTTP autenticada. Ele varre previsões ainda não avaliadas cujas partidas já terminaram, calcula o resultado (Win/Lose por V/E/D), soma XP e Money Saved, atualiza a streak de dias sem apostar, e persiste tudo de forma idempotente — sem gerar rankings.

## Goals

- [x] Toda previsão de uma partida finalizada é avaliada exatamente uma vez (idempotência garantida por `points_earned IS NULL`)
- [x] `users.money_saved`, `users.xp`, `users.level`, `users.current_streak`, `users.last_streak_date` refletem o histórico real de previsões processadas
- [x] Processamento pode ser disparado repetidamente (via cron a cada 10 min) sem duplicar efeitos nem correr em paralelo consigo mesmo

## Out of Scope

| Feature                                            | Reason                                                               |
| -------------------------------------------------- | -------------------------------------------------------------------- |
| Geração de rankings                                | Explicitamente fora do escopo desta feature (pedido do usuário)      |
| Reprocessamento manual / correção de placar tardia | Decisão da interview: sem reprocessamento manual por agora           |
| Teto máximo de validação em `wagered_amount`       | Decisão da interview: sem teto, apenas `> 0`                         |
| Streak de acertos consecutivos                     | Streak é sobre dias sem apostar dinheiro real, não sobre performance |

---

## User Stories

### P1: Avaliar Win/Lose e gravar accuracy ⭐ MVP

**User Story**: Como usuário que fez uma previsão, quero que o sistema determine se acertei o resultado (V/E/D) da partida assim que ela terminar, para que minha accuracy no dashboard reflita a realidade.

**Why P1**: Base de tudo — sem isso não há dado para calcular XP nem Money Saved.

**Acceptance Criteria**:

1. WHEN uma partida tem `status = 'finished'` e existe uma previsão com `points_earned IS NULL` para ela THEN o sistema SHALL comparar o resultado previsto (derivado de `predicted_home_score`/`predicted_away_score`) com o resultado real (derivado de `home_score`/`away_score`)
2. WHEN o resultado previsto é igual ao resultado real (incluindo empate previsto = empate real) THEN o sistema SHALL gravar `points_earned = 1` (Win)
3. WHEN o resultado previsto diverge do resultado real THEN o sistema SHALL gravar `points_earned = 0` (Lose)
4. WHEN uma previsão já tem `points_earned` preenchido (não nulo) THEN o sistema SHALL ignorá-la (não reprocessar)

**Independent Test**: Criar partida finalizada com placar conhecido + previsões variadas (acerto de resultado, erro, empate correto); rodar processor; verificar `points_earned` de cada previsão.

---

### P1: Atualizar XP e Level ⭐ MVP

**User Story**: Como usuário, quero ganhar XP quando acerto uma previsão, para progredir de nível no app.

**Why P1**: Núcleo da gamificação já exposta no dashboard.

**Acceptance Criteria**:

1. WHEN uma previsão é avaliada como Win THEN o sistema SHALL somar 100 a `users.xp`
2. WHEN uma previsão é avaliada como Lose THEN o sistema SHALL somar 0 a `users.xp` (sem alteração)
3. WHEN `users.xp` é atualizado THEN o sistema SHALL recalcular e gravar `users.level = floor(xp / 3000) + 1`, mantendo consistência com o valor computado na leitura do dashboard

**Independent Test**: Processar N previsões conhecidas (com resultado misto) de um usuário; verificar `xp` final = soma esperada e `level` = `floor(xp/3000)+1`.

---

### P1: Atualizar Money Saved com valor apostado opcional ⭐ MVP

**User Story**: Como usuário, quero opcionalmente informar quanto apostaria em uma partida ao fazer minha previsão, para que meu "dinheiro economizado" reflita um valor real e não apenas um valor fixo genérico.

**Why P1**: Decisão explícita da interview — trazido de volta ao escopo (não deferido).

**Acceptance Criteria**:

1. WHEN o usuário submete uma previsão via `features/matches/actions/predictions.ts` THEN o sistema SHALL aceitar um campo opcional `wagered_amount` (> 0, sem teto máximo)
2. WHEN o usuário não informa `wagered_amount` THEN o sistema SHALL gravar `NULL` nesse campo (sem valor default de banco)
3. WHEN uma previsão é processada (Win ou Lose) THEN o sistema SHALL somar a `users.money_saved` o valor de `predictions.wagered_amount` se presente, ou R$10 fixo caso `NULL`
4. WHEN `wagered_amount` é fornecido com valor <= 0 THEN o sistema SHALL rejeitar a submissão da previsão com erro de validação

**Independent Test**: Submeter previsões com e sem `wagered_amount`; processar; verificar incremento correto em `users.money_saved` em cada caso.

---

### P1: Atualizar streak de dias sem apostar dinheiro real ⭐ MVP

**User Story**: Como usuário, quero ver há quantos dias uso a plataforma evitando apostar dinheiro real, como métrica motivacional que nunca regride.

**Why P1**: Parte central da proposta de valor "bet-free"; decisão explícita da interview.

**Acceptance Criteria**:

1. WHEN uma previsão de um usuário é processada e o dia civil (fuso Brasil, mesmo critério de `get-brazil-day-bounds.ts`) da partida difere de `users.last_streak_date` THEN o sistema SHALL incrementar `users.current_streak` em 1 e atualizar `users.last_streak_date` para esse dia civil
2. WHEN o dia civil já é igual a `users.last_streak_date` THEN o sistema SHALL não incrementar `current_streak` novamente
3. WHEN `current_streak` é incrementado THEN o sistema SHALL nunca decrementá-lo ou zerá-lo em nenhuma circunstância

**Independent Test**: Processar múltiplas previsões do mesmo usuário no mesmo dia civil (streak incrementa 1x) e em dias civis diferentes (streak incrementa por dia); confirmar nunca há decremento.

---

### P1: Endpoint de processamento idempotente e protegido ⭐ MVP

**User Story**: Como sistema de automação (cron do GitHub Actions), quero disparar o processamento de previsões via uma rota HTTP segura e sem condição de corrida, para manter o mesmo padrão operacional já usado na sincronização de partidas.

**Why P1**: Sem trigger e proteção contra execução concorrente, o processor não pode rodar em produção com segurança.

**Acceptance Criteria**:

1. WHEN uma requisição `POST /api/predictions/process` chega sem header `x-sync-secret` válido THEN o sistema SHALL retornar 401/403 sem processar nada
2. WHEN uma requisição válida chega enquanto outra execução do tipo `'predictions'` já está em andamento (via `withSyncLock`) THEN o sistema SHALL rejeitar com erro de conflito (mesmo padrão de `SyncAlreadyRunningError`)
3. WHEN a rota é executada com sucesso THEN o sistema SHALL processar todas as previsões elegíveis (`points_earned IS NULL AND matches.status = 'finished'`) em uma única execução
4. WHEN a execução termina (sucesso ou erro) THEN o sistema SHALL liberar o lock em `sync_runs`, permitindo a próxima execução agendada

**Independent Test**: Chamar a rota sem secret (falha), com secret válido (sucesso), e disparar duas chamadas concorrentes (segunda deve falhar por lock).

---

## Edge Cases

- WHEN não existe nenhuma previsão elegível no momento da execução THEN o sistema SHALL retornar sucesso (200) sem erro, processando zero registros
- WHEN uma partida finalizada não tem nenhuma previsão associada THEN o sistema SHALL simplesmente não gerar trabalho para ela (nada a atualizar)
- WHEN uma partida tem `status IN ('postponed','cancelled')` THEN o sistema SHALL nunca selecioná-la para processamento (fora do filtro `status = 'finished'`)
- WHEN múltiplos usuários têm previsões na mesma partida finalizada THEN o sistema SHALL processar cada previsão e atualizar as estatísticas de cada usuário independentemente
- WHEN o mesmo usuário tem previsões de partidas finalizadas em dias civis diferentes dentro de uma única execução do processor THEN o sistema SHALL incrementar `current_streak` uma vez por dia civil distinto, processando em ordem cronológica

---

## Requirement Traceability

| Requirement ID | Story                                  | Phase    | Status   |
| -------------- | -------------------------------------- | -------- | -------- |
| PRED-01        | P1: Avaliar Win/Lose e gravar accuracy | In Tasks | Done     |
| PRED-02        | P1: Atualizar XP e Level               | In Tasks | Done     |
| PRED-03        | P1: Atualizar Money Saved              | In Tasks | Done     |
| PRED-04        | P1: Atualizar streak                   | In Tasks | Done     |
| PRED-05        | P1: Endpoint idempotente e protegido   | In Tasks | Done     |

**Coverage:** 5 total, 5 mapped to tasks, 0 unmapped

---

## Success Criteria

- [x] Rodar o processor duas vezes seguidas sobre o mesmo conjunto de dados produz o mesmo estado final (idempotência comprovada)
- [x] `users.xp`, `users.level`, `users.money_saved`, `users.current_streak`, `users.last_streak_date` e `predictions.points_earned` são escritos corretamente para um conjunto de partidas/previsões de teste conhecido
- [x] Rota rejeita chamadas sem secret válido e rejeita execução concorrente
