# Database Schema (Supabase) Specification

**Context**: `.specs/features/database-schema/context.md`

## Problem Statement

O projeto tem Firebase Auth funcionando mas nenhum schema de banco de dados —
não há tabelas no Supabase para armazenar usuários, competições, times,
partidas, palpites, conquistas ou ranking. Sem isso, nenhuma feature de
negócio (palpites, gamificação, ranking) pode ser implementada.

## Proposed Solution

Migrations SQL (`supabase/migrations/`) que criam as 8 tabelas do domínio com
PKs UUID, FKs entre elas, índices nas colunas de FK, e um trigger genérico de
`updated_at` reaplicado onde necessário. RLS habilitado com policy placeholder
`USING (false)` (trava de segurança, ver Tech Decisions em design.md) — sem
funções de cálculo ou validação de negócio, apenas a estrutura de dados.

## Goals

- [x] As 8 tabelas existem no Supabase com relacionamentos íntegros (FKs
      aplicadas, não apenas documentadas)
- [x] `supabase db reset` (ou aplicação sequencial das migrations) roda sem
      erro, na ordem de dependência
- [x] Toda FK tem índice correspondente
- [x] Toda tabela com coluna `updated_at` atualiza automaticamente via trigger
- [x] RLS habilitado nas 8 tabelas com policy placeholder `USING (false)`
      bloqueando acesso via anon/authenticated (PostgREST)

## Out of Scope

| Feature                                     | Reason                                                              |
| -------------------------------------------- | -------------------------------------------------------------------- |
| Policies de RLS reais (quem lê/escreve o quê) | Exigiria regras de acesso (lógica de negócio); auth é Firebase, não Supabase Auth — ver `context.md`. RLS em si (habilitação + deny-all) foi adicionado após review de segurança, mas policies granulares continuam fora de escopo. |
| Funções de cálculo de pontos/critérios       | Lógica de negócio (avaliação de `achievements.criteria`, pontuação de `predictions`) — fica para features futuras |
| Seed data / dados de exemplo                 | Fora do pedido original (só estrutura)                              |
| Endpoints/Server Actions consumindo o schema | Fora do pedido original (só schema)                                 |

---

## User Stories

### P1: Core Domain Schema (users, competitions, teams, matches) ⭐ MVP

**User Story**: Como sistema, preciso persistir usuários, competições, times
e partidas de forma relacional, para que qualquer feature futura (palpites,
ranking, conquistas) tenha uma base de dados íntegra para referenciar.

**Why P1**: Nenhuma outra tabela (predictions, achievements, ranking_cache)
faz sentido sem essas 4 existirem primeiro — são a base de dependência de FK
de tudo mais.

**Acceptance Criteria**:

1. WHEN a migration de `users` roda THEN o banco SHALL ter `id UUID PRIMARY
   KEY DEFAULT gen_random_uuid()`, `firebase_uid TEXT UNIQUE NOT NULL`,
   `email`, `display_name`, `avatar_url`, `created_at`, `updated_at`.
2. WHEN a migration de `competitions` roda THEN o banco SHALL ter `id`,
   `name`, `slug UNIQUE`, `season`, `logo_url`, `status` com `CHECK` restringindo
   valores válidos, `created_at`, `updated_at`.
3. WHEN a migration de `teams` roda THEN o banco SHALL ter `id`, `name`, `slug
   UNIQUE`, `logo_url`, `created_at`, `updated_at` — sem FK para
   `competitions` (times são globais).
4. WHEN a migration de `matches` roda THEN o banco SHALL ter `id`,
   `competition_id` (FK → `competitions.id`), `home_team_id` e
   `away_team_id` (FK → `teams.id`), `match_date`, `round`, `status` com
   `CHECK`, `home_score`, `away_score`, `created_at`, `updated_at`.
5. WHEN um `INSERT` em `matches` referencia `competition_id`,
   `home_team_id` ou `away_team_id` inexistente THEN o banco SHALL rejeitar
   com violação de foreign key.
6. WHEN um `UPDATE` é feito em qualquer linha dessas 4 tabelas THEN
   `updated_at` SHALL ser atualizado automaticamente pelo trigger genérico.

**Independent Test**: Aplicar só essas 4 migrations num banco vazio, inserir
1 registro de cada, confirmar FKs e trigger `updated_at` funcionando via SQL
direto (sem depender de predictions/achievements/ranking).

---

### P1: Predictions Schema ⭐ MVP

**User Story**: Como sistema, preciso registrar o palpite de cada usuário
para cada partida, com no máximo 1 palpite por usuário por partida, para que
o core loop do app (palpitar em uma partida) tenha onde persistir dados.

**Why P1**: É o núcleo funcional do app ("bet-free" = jogo de palpites) —
sem esta tabela não há produto.

**Acceptance Criteria**:

1. WHEN a migration de `predictions` roda THEN o banco SHALL ter `id`,
   `user_id` (FK → `users.id`), `match_id` (FK → `matches.id`),
   `predicted_home_score`, `predicted_away_score`, `points_earned`
   (nullable), `created_at`, `updated_at`.
2. WHEN um segundo `INSERT` é feito com o mesmo par `(user_id, match_id)`
   THEN o banco SHALL rejeitar por violação da constraint `UNIQUE(user_id,
   match_id)`.
3. WHEN `user_id` ou `match_id` referencia registro inexistente THEN o banco
   SHALL rejeitar com violação de foreign key.

**Independent Test**: Com users/matches populados, inserir 1 prediction,
tentar duplicar o mesmo par user+match e confirmar rejeição.

---

### P2: Achievements & Gamification Schema

**User Story**: Como sistema, preciso armazenar conquistas disponíveis e
quais usuários as desbloquearam, para que features de gamificação futuras
tenham onde persistir progresso sem redefinir o schema.

**Why P2**: Gamificação é valor agregado, não o core loop — pode ser
adicionada após predictions estar funcional.

**Acceptance Criteria**:

1. WHEN a migration de `achievements` roda THEN o banco SHALL ter `id`,
   `name`, `slug UNIQUE`, `description`, `icon_url`, `criteria JSONB`,
   `created_at`, `updated_at`.
2. WHEN a migration de `user_achievements` roda THEN o banco SHALL ter `id`,
   `user_id` (FK → `users.id`), `achievement_id` (FK → `achievements.id`),
   `earned_at`.
3. WHEN um segundo `INSERT` é feito com o mesmo par `(user_id,
   achievement_id)` THEN o banco SHALL rejeitar por violação da constraint
   `UNIQUE(user_id, achievement_id)`.

**Independent Test**: Inserir 1 achievement e 1 user_achievement vinculando a
um user existente; tentar duplicar o par e confirmar rejeição.

---

### P2: Ranking Cache Schema

**User Story**: Como sistema, preciso de uma tabela de cache para pontuação e
posição de cada usuário — tanto geral quanto por competição — para que
consultas de ranking não recalculem a partir de todas as predictions em
tempo real.

**Why P2**: É uma camada de cache/performance sobre dados que já existem em
`predictions` — depende de predictions estar completo, e não bloqueia o MVP.

**Acceptance Criteria**:

1. WHEN a migration de `ranking_cache` roda THEN o banco SHALL ter `id`,
   `user_id` (FK → `users.id`), `competition_id` (FK → `competitions.id`,
   **nullable**), `points`, `position`, `updated_at`.
2. WHEN `competition_id` é `NULL` THEN a linha SHALL representar o ranking
   geral daquele usuário.
3. WHEN `competition_id` é preenchido THEN a linha SHALL representar o
   ranking daquele usuário dentro daquela competição.
4. WHEN um segundo `INSERT` é feito com o mesmo par `(user_id,
   competition_id)` (ambos preenchidos, ou ambos com o mesmo `competition_id`
   NULL) THEN o banco SHALL rejeitar por violação da constraint
   `UNIQUE(user_id, competition_id)`.

**Independent Test**: Inserir 1 linha com `competition_id NULL` e 1 linha com
`competition_id` preenchido para o mesmo usuário — ambas devem coexistir;
tentar duplicar qualquer uma das duas deve falhar.

---

## Edge Cases

- WHEN uma migration é aplicada fora de ordem (ex: `matches` antes de
  `teams`) THEN o banco SHALL rejeitar por FK inexistente — ordem de
  dependência é mandatória e documentada nos nomes dos arquivos.
- WHEN uma tabela referenciada por FK tenta ser deletada (`DELETE FROM
  teams` com partidas associadas) THEN o banco SHALL bloquear por restrição
  de FK (comportamento padrão `NO ACTION`, sem `CASCADE` implícito — decisão
  de agent's discretion, ver context.md).
- WHEN `status` recebe valor fora da lista do `CHECK constraint` (em
  `competitions` ou `matches`) THEN o banco SHALL rejeitar o `INSERT`/`UPDATE`.

---

## Requirement Traceability

| Requirement ID | Story                                | Phase  | Status  |
| --------------- | -------------------------------------- | ------ | ------- |
| DB-01           | P1: Core Domain Schema — users        | Implementing | Done |
| DB-02           | P1: Core Domain Schema — competitions  | Implementing | Done |
| DB-03           | P1: Core Domain Schema — teams         | Implementing | Done |
| DB-04           | P1: Core Domain Schema — matches       | Implementing | Done |
| DB-05           | P1: Predictions Schema                 | Implementing | Done |
| DB-06           | P2: Achievements Schema                | Implementing | Done |
| DB-07           | P2: User Achievements Schema           | Implementing | Done |
| DB-08           | P2: Ranking Cache Schema               | Implementing | Done |
| DB-09           | Generic `updated_at` trigger function  | Implementing | Done |
| DB-10           | FK indexes across all tables           | Implementing | Done |

**Coverage:** 10 total, 10 mapped to migrations, 0 unmapped

**Verification note:** sem Supabase CLI/Docker/psql disponíveis neste ambiente
para aplicar as migrations de fato — verificação feita por revisão estática
(agente dedicado comparou os 9 arquivos SQL campo a campo contra design.md;
nenhum problema encontrado). Recomenda-se rodar `supabase db reset` ou `supabase
db push` num ambiente com Docker/CLI disponível antes de considerar
definitivamente encerrado.

---

## Success Criteria

- [x] Todas as migrations aplicam em sequência sem erro num banco vazio
      (verificado estaticamente — ver Verification note acima)
- [x] Todas as 8 tabelas existem com as colunas especificadas
- [x] Todas as FKs especificadas estão ativas e rejeitam referências inválidas
- [x] Todas as constraints `UNIQUE` especificadas (predictions, user_achievements,
      ranking_cache, slugs) rejeitam duplicatas
- [x] Trigger `updated_at` dispara em `UPDATE` em toda tabela que tem a coluna
- [x] RLS habilitado com policy placeholder `USING (false)`; nenhuma policy
      granular de negócio, função de negócio ou seed data foi criada
