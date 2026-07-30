# PredictionProcessor — Interview Decisions

**Date:** 2026-07-30
**Scope:** PredictionProcessor lê partidas finalizadas, localiza previsões relacionadas, calcula Win/Lose/Money Saved/Accuracy/XP por previsão, e atualiza as estatísticas do usuário (`money_saved`, `xp`, `level`, `current_streak`). Rankings ficam fora de escopo.
**Source:** Interview interativa (sem spec prévio; feature referenciada antecipadamente em `.specs/features/dashboard/context.md`, `.specs/features/database-schema/spec.md` e `.specs/features/github-actions-sync/context.md`)

---

## Decisions

### Critério Win/Lose

- Critério é o **resultado (Vitória/Empate/Derrota)**, não o placar exato.
- Deriva-se o resultado previsto (mandante vence / empate / visitante vence) a partir de `predicted_home_score`/`predicted_away_score`.
- Deriva-se o resultado real a partir de `home_score`/`away_score` da partida finalizada.
- **Win** = resultado previsto bate com o resultado real (inclui empate previsto = empate real).
- **Lose** = qualquer divergência.

### `points_earned`

- Processor escreve `1` para Win, `0` para Lose.
- Mantém compatibilidade com a leitura já existente em `features/dashboard/services/get-dashboard-data.ts` (`points_earned > 0` = acerto).

### XP

- Win = **100 XP** fixo. Lose = **0 XP**.
- XP é somado a `users.xp` (sem teto).
- Processor também escreve `users.level` usando a mesma fórmula já usada na leitura do dashboard: `level = floor(xp / 3000) + 1` (XP_THRESHOLD = 3000).
- **Rationale:** evita a divergência já sinalizada em `.specs/features/dashboard/context.md` entre `users.level` armazenado e o valor calculado na leitura.

### Money Saved

- Incrementa **por previsão processada** (Win ou Lose), não só em acerto — reflete a narrativa "cada previsão grátis é dinheiro que ficou com você".
- Novo campo: `predictions.wagered_amount NUMERIC(10,2) NULL` — opcional, preenchido pelo usuário na criação da previsão (quanto ele apostaria naquele jogo).
- Validação na criação: apenas `> 0`, **sem teto máximo**.
- Fallback: se `wagered_amount` não for preenchido, processor usa **R$10** fixo ao somar em `users.money_saved`.
- **Rationale:** usuário decidiu expandir o escopo original para incluir o campo de valor customizável em vez de deferir, dado que enriquece a narrativa "dinheiro evitado" com dado real do usuário.

### Streak (`current_streak`)

- Semântica: **não é streak de acertos** — é contador cumulativo de dias em que o usuário usou a plataforma e evitou apostar dinheiro real ("dias sóbrio").
- **Nunca zera** — é monotonicamente crescente.
- Incrementa **1 por dia civil** (não por previsão processada), usando o mesmo critério de fuso horário Brasil já existente em `features/matches/lib/get-brazil-day-bounds.ts`.
- Novo campo: `users.last_streak_date DATE NULL` — controla se o dia civil da previsão sendo processada já foi contado.
  - Se o dia civil da previsão processada for diferente de `last_streak_date`: incrementa `current_streak` em 1 e atualiza `last_streak_date`.
  - Se for o mesmo dia civil: não incrementa novamente.

### Arquitetura / Trigger / Idempotência

- Nova rota: `POST /api/predictions/process`.
- Segue exatamente o padrão já usado em `features/sports-sync`:
  - Autenticação via header `x-sync-secret` (`lib/sync-auth.ts`, `isValidSyncSecret`).
  - Protegida por `withSyncLock` (`sync-lock-service.ts`), com novo valor de tipo `'predictions'` — requer estender o CHECK constraint de `sync_runs.type`.
- Chamada pelo cron do GitHub Actions (`live-sync.yml`) logo após `/api/sync/finished`, conforme o TODO comentado já existente no workflow.
- Critério de seleção (idempotência): `predictions.points_earned IS NULL AND matches.status = 'finished'`.
- **Sem reprocessamento manual por agora** — uma vez que `points_earned` é setado, a previsão nunca é reprocessada pelo processor. Correção manual de placar pós-processamento está fora de escopo.

---

## Agent's Discretion

- Nenhuma área foi delegada como "você decide" nesta interview — todas as decisões de negócio foram fechadas explicitamente pelo usuário.
- Detalhes puramente de implementação não cobertos aqui (nomes internos de funções, organização de arquivos dentro de `features/predictions/`, formato exato de testes) ficam a critério do implementador, seguindo os padrões já estabelecidos em `features/sports-sync`.

---

## Deferred Ideas

- Nenhuma — a única ideia que surgiria como potencialmente fora de escopo (valor de Money Saved customizável pelo usuário) foi puxada de volta para dentro do escopo por decisão explícita do usuário.

---

## Open Questions

- Nenhuma pendência bloqueante identificada. Dois itens de schema precisam de migration antes da implementação:
  - `predictions.wagered_amount NUMERIC(10,2) NULL`
  - `users.last_streak_date DATE NULL`
  - Extensão do CHECK constraint de `sync_runs.type` para incluir `'predictions'`
