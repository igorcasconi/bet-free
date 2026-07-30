# Ranking Engine — Interview Decisions

**Date:** 2026-07-30
**Scope:** Ranking Engine calcula e mantém em cache (tabela `ranking_cache`, sem recalcular a cada request) três rankings — Accuracy, Discipline e Money Saved — populando `points`/`position` por usuário.
**Source:** Interview interativa (sem spec prévio; feature referenciada como out-of-scope explícito em `.specs/features/prediction-processor/spec.md` e `.specs/features/database-schema/spec.md`)

---

## Decisions

### Schema de `ranking_cache`

- Adicionar coluna `ranking_type TEXT CHECK IN ('accuracy', 'discipline', 'money_saved')`.
- Estender constraint única de `(user_id, competition_id)` para `(user_id, competition_id, ranking_type)`.
- Estender o índice parcial de ranking geral (`ranking_cache_general_unique`, hoje `ON (user_id) WHERE competition_id IS NULL`) para incluir `ranking_type` também.
- **Rationale:** mantém a semântica genérica de `points`/`position` já existente na tabela; cada usuário passa a ter até 3 linhas por competição (uma por tipo de ranking) em vez de 1. Extensível a um 4º tipo de ranking sem nova migração de schema.

### Fórmula de Accuracy Ranking

- Reutiliza a fórmula já usada no dashboard: `acertos / total de previsões com points_earned IS NOT NULL`.
- **Mínimo de elegibilidade: 5 previsões processadas** (`points_earned IS NOT NULL`) para aparecer no ranking. Usuário abaixo do mínimo não tem linha em `ranking_cache` para `ranking_type = 'accuracy'`.
- **Rationale:** evita que amostra pequena (ex: 1 previsão, 1 acerto = 100%) domine o ranking.

### Fórmula de Discipline Ranking

- Ordena por `users.current_streak DESC` — métrica já existente (dias civis consecutivos, fuso Brasil, em que o usuário fez ao menos uma previsão processada; nunca zera).
- Sem mínimo de elegibilidade adicional além do que já existe naturalmente (streak começa em 0).

### Fórmula de Money Saved Ranking

- Ordena por `users.money_saved DESC`.
- Sem mínimo de elegibilidade.

### Critério de desempate (todos os 3 rankings)

- `ORDER BY <métrica> DESC, id` — desempate puramente técnico/determinístico (por `id` do usuário), sem significado de negócio. Aplicado uniformemente aos 3 rankings.

### Escopo geral vs. por competição

- Apenas **ranking geral** (`competition_id IS NULL`) por agora.
- Schema já suporta ranking por competição no futuro (`competition_id` preenchido) sem nova migração — decisão explicitamente adiada, não implementada nesta rodada.

### Arquitetura / Trigger / Recálculo

- Nova rota `POST /api/rankings/process`, mesmo padrão de `/api/predictions/process`:
  - Autenticação via `x-sync-secret` (`isValidSyncSecret`, `env.SYNC_SECRET`).
  - Protegida por `withSyncLock`, novo tipo `'rankings'` — requer estender `SyncType` (`sync-lock-service.ts`) e o CHECK constraint de `sync_runs.type` (nova migração).
  - Chamada no mesmo cron `live-sync.yml`, logo após `/api/predictions/process` (dependência lógica: rankings dependem de `points_earned`/`money_saved`/`current_streak` já atualizados por esse passo).
- **Recálculo completo a cada execução** — não incremental. Cada run recomputa os 3 rankings do zero (todos os usuários elegíveis) e faz upsert em `ranking_cache`.
  - Deve remover/não deixar obsoleta qualquer linha de usuário que caiu abaixo do mínimo de elegibilidade (ex: accuracy com menos de 5 previsões) — não há conceito de "manter posição antiga".

---

## Agent's Discretion

- Nenhuma área foi delegada como "você decide" nesta interview — todas as decisões de negócio foram fechadas explicitamente pelo usuário.
- Detalhes puramente de implementação (nomes internos de funções/arquivos dentro de `features/ranking-engine/`, forma exata do upsert/delete de linhas obsoletas, formato de testes) ficam a critério do implementador, seguindo os padrões já estabelecidos em `features/prediction-processing` e `features/sports-sync`.

---

## Deferred Ideas

- Ranking por competição (`competition_id` preenchido) — schema já suporta, mas implementação adiada para feature futura.
- Recálculo incremental (só usuários afetados desde o último run) — prematuro sem dado de volume real.
- Desempate por accuracy no Money Saved Ranking (ou qualquer regra de negócio cruzada entre rankings) — descartado a favor de desempate puramente técnico.

---

## Open Questions

- Nenhuma pendência bloqueante identificada. Duas migrações de schema precisam ser criadas antes da implementação:
  - `ranking_cache.ranking_type` + constraints estendidas
  - Extensão do CHECK constraint de `sync_runs.type` para incluir `'rankings'`
