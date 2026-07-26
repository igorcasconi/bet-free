# Database Schema (Supabase) — Interview Decisions

**Date:** 2026-07-26
**Scope:** Criar o schema completo do banco Supabase via migrations SQL — tabelas users, competitions, teams, matches, predictions, achievements, user_achievements, ranking_cache — com PKs UUID, FKs, índices e triggers de `updated_at`. Sem lógica de negócio (sem RLS, sem funções de cálculo/validação além do trigger genérico de timestamp).
**Source:** Discussão informal (comando `/interview` com argumentos de schema)

---

## Decisões

### users

- PK `id UUID`. Coluna `firebase_uid TEXT UNIQUE NOT NULL` referencia o uid do Firebase Auth (fonte da verdade de autenticação — projeto usa Firebase, não Supabase Auth).
- Campos: `email`, `display_name`, `avatar_url` (espelham `AuthUser` do `features/auth`, sem duplicar dados de auth além do necessário).
- **Rationale:** desacopla PK interna (usada por FKs de predictions/user_achievements/ranking_cache) do provedor de auth.

### competitions

- Campos: `name`, `slug` (único), `season`, `logo_url`, `status` (TEXT + CHECK).

### teams

- Entidades globais, sem `competition_id` — reutilizáveis entre competições/temporadas via `matches.competition_id`.
- Campos: `name`, `slug` (único), `logo_url`.
- **Rationale:** evita duplicar o mesmo time a cada campeonato em que participa.

### matches

- Campos: `competition_id` (FK), `home_team_id` (FK teams), `away_team_id` (FK teams), `match_date`, `round`, `status` (TEXT + CHECK), `home_score`, `away_score`.

### predictions

- Campos: `user_id` (FK), `match_id` (FK), `predicted_home_score`, `predicted_away_score`, `points_earned` (nullable, preenchido após o jogo).
- `UNIQUE(user_id, match_id)` — 1 palpite por usuário por partida.

### achievements / user_achievements

- `achievements`: `name`, `slug` (único), `description`, `icon_url`, `criteria JSONB` (formato livre, ex: `{"type":"streak","value":5}` — avaliação do critério é lógica de aplicação, fora do schema).
- `user_achievements`: `user_id` (FK), `achievement_id` (FK), `earned_at`. `UNIQUE(user_id, achievement_id)`.

### ranking_cache

- `competition_id UUID` **nullable**, FK para `competitions`. `NULL` = ranking geral; preenchido = ranking daquela competição.
- Campos: `user_id` (FK), `competition_id`, `points`, `position`, `updated_at`.
- `UNIQUE(user_id, competition_id)` (NULLs distintos por padrão do Postgres — cada usuário pode ter 1 linha geral + 1 por competição).

### Tipos de status (matches, competitions)

- `TEXT` + `CHECK constraint`, não ENUM nativo do Postgres.
- **Rationale:** mais fácil alterar valores permitidos depois via `ALTER TABLE ... DROP/ADD CONSTRAINT`, sem as restrições transacionais de `ALTER TYPE ... ADD VALUE`.

### RLS (Row Level Security)

- **Revisado após o review de segurança.** A decisão original ("fora do escopo") assumia acesso só via service role, mas `lib/supabase/client.ts` já instancia o client com a anon key pública (`NEXT_PUBLIC_SUPABASE_ANON_KEY`), destinada a rodar no browser — com RLS desabilitado, PostgREST concede acesso de leitura/escrita a `anon`/`authenticated` por padrão em todas as tabelas.
- **Decisão atualizada:** RLS habilitado nas 8 tabelas com uma policy placeholder `USING (false)` para `anon`/`authenticated` (migration `00000000000010_enable_rls.sql`). Isso bloqueia todo acesso via PostgREST/anon key até que políticas reais existam; o service role (usado no backend) continua tendo acesso normal, pois RLS não se aplica a ele.
- **Rationale:** políticas de acesso reais (quem pode ler/escrever o quê) ainda são lógica de negócio e continuam fora de escopo — mas deixar RLS totalmente desligado era um risco de exposição pública de dados (PII em `users`, `predictions`, etc.), não apenas "lógica de negócio pendente". `USING (false)` é puramente uma trava de segurança, não uma regra de domínio.

### Trigger de `updated_at`

- Uma função genérica `set_updated_at()` criada uma única vez (primeira migration), reaplicada via `CREATE TRIGGER ... BEFORE UPDATE ... EXECUTE FUNCTION set_updated_at()` em cada tabela que tiver a coluna.
- **Rationale:** evita duplicar a mesma lógica em 8 tabelas.

### Convenção de migrations

- `supabase/migrations/` no padrão do Supabase CLI (arquivos numerados/timestamped, um por tabela/etapa, na ordem de dependência: função genérica → users → competitions → teams → matches → predictions → achievements → user_achievements → ranking_cache).
- **Rationale:** compatível com `supabase db push` / `supabase migration up` caso o time adote o CLI depois.

### Índices

- FKs recebem índice (padrão Postgres não cria índice automático em FK): `matches.competition_id`, `matches.home_team_id`, `matches.away_team_id`, `predictions.user_id`, `predictions.match_id`, `user_achievements.user_id`, `user_achievements.achievement_id`, `ranking_cache.user_id`, `ranking_cache.competition_id`.
- Colunas `slug` já cobertas pela constraint UNIQUE (índice implícito).

---

## Agent's Discretion

- Tipos exatos de timestamp (`TIMESTAMPTZ` recomendado sobre `TIMESTAMP`), nomes exatos de constraints/índices, ordem exata dos arquivos de migration dentro da convenção acordada.
- Se `created_at`/`updated_at` devem existir em todas as 8 tabelas (recomendo sim, por consistência) ou omitir `updated_at` em tabelas append-only como `user_achievements` (sem coluna para atualizar, então trigger dispensável ali).

---

## Deferred Ideas

- Nenhuma — nenhuma lógica de negócio, RLS, seed data ou UI foi discutida; tudo fica para rodadas futuras se necessário.

---

## Open Questions

- Nenhuma pendente.
