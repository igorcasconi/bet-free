# Review — database-schema

**Modo:** Local
**Escopo:** 12 arquivos novos (9 migrations SQL + context.md/design.md/spec.md), 0 commits (mudanças untracked em `main`)
**Subagentes:** 6 de 6 (Security, Requirements, Tests, Architecture, Regression, Performance)
**Docs carregados:** `database-schema/context.md`, `database-schema/design.md`, `database-schema/spec.md`, `CLAUDE.md`, `lib/supabase/client.ts`, `lib/env.ts`
**Findings:** 9 across 6 files

---

## SECURITY (1) — ✅ Corrigido

- `supabase/migrations/00000000000002_create_users.sql` (e demais 03–09) — RLS desabilitado em todas as 8 tabelas, combinado com `lib/supabase/client.ts` já instanciando `createClient` com `NEXT_PUBLIC_SUPABASE_ANON_KEY` (chave pública embutida no bundle do browser). Comportamento padrão do PostgREST/Supabase concede SELECT/INSERT/UPDATE/DELETE aos roles `anon`/`authenticated` quando RLS está desligado — qualquer pessoa com a anon key podia ler/escrever `users` (incluindo `email`, `firebase_uid`), `predictions`, `ranking_cache` etc. diretamente, sem passar pela aplicação.
  **✅ Corrigido:** nova migration `00000000000010_enable_rls.sql` habilita `ROW LEVEL SECURITY` nas 8 tabelas com policy placeholder `USING (false)` para `anon`/`authenticated` — bloqueia todo acesso via PostgREST/anon key. Service role (backend) não é afetado por RLS. Policies granulares de negócio continuam fora de escopo — ver `context.md` atualizado.

---

## CRITICAL (0)

Nenhum.

---

## PERFORMANCE (3) — ✅ Corrigido

- `supabase/migrations/00000000000005_create_matches.sql` — ✅ adicionado `CREATE INDEX matches_status_match_date_idx ON matches (status, match_date);`
- `supabase/migrations/00000000000009_create_ranking_cache.sql` — ✅ adicionado `CREATE INDEX ranking_cache_competition_points_idx ON ranking_cache (competition_id, points DESC);`
- `supabase/migrations/00000000000003_create_competitions.sql` — ✅ adicionado `CREATE INDEX competitions_status_idx ON competitions (status);`

`design.md` atualizado para refletir os 3 novos índices.

---

## WARNING (2) — 1 corrigido, 1 pendente

- ✅ **Corrigido** — `gen_random_uuid()` sem extensão declarada: adicionado `CREATE EXTENSION IF NOT EXISTS "pgcrypto";` no topo de `00000000000001_create_set_updated_at_function.sql`.
- **Pendente** — `.specs/features/database-schema/spec.md:151` — os "Independent Test" descritos por user story (inserir + tentar duplicar/violar FK) nunca foram de fato executados — sem Docker/Supabase CLI/psql neste ambiente, a verificação foi só revisão estática. O spec já registra essa limitação na "Verification note", mas Success Criteria e Requirement Traceability estão marcados como `[x]`/`Done`, o que pode passar confiança de execução real.
  **Recomendação:** rodar `supabase db reset` (ou `psql` sequencial) num ambiente com Docker/CLI disponível e executar os 4 Independent Test antes de tratar isso como definitivamente encerrado.

---

## SUGGESTION (3)

- `supabase/migrations/00000000000006_create_predictions.sql:14` — `predictions_user_id_idx` é potencialmente redundante: `UNIQUE (user_id, match_id)` já cria um índice composto com `user_id` como coluna líder, usável pelo planner para buscas só por `user_id`. Design.md já prescreve esse índice — se confirmado redundante, remover dos dois lugares; senão, documentar por que é necessário além do composto.
- `supabase/migrations/00000000000005_create_matches.sql:3-5` (e predictions/user_achievements/ranking_cache) — todas as FKs usam `ON DELETE NO ACTION` sem comentário explicando a intenção (bloquear exclusão de dados históricos). Considerar um comentário SQL curto.
- Nenhum script de smoke-test SQL versionado (`supabase/tests/*.sql`) captura os cenários de "Independent Test" do spec.md como queries prontas — útil para reexecutar assim que Docker/CLI estiverem disponíveis (opcional, fora do escopo "sem lógica de negócio").

---

## Files With No Findings

- `supabase/migrations/00000000000001_create_set_updated_at_function.sql`
- `supabase/migrations/00000000000004_create_teams.sql`
- `supabase/migrations/00000000000007_create_achievements.sql`
- `supabase/migrations/00000000000008_create_user_achievements.sql`
- `.specs/features/database-schema/context.md`
- `.specs/features/database-schema/design.md`

---

## Highlights

- **Security:** PKs UUID consistentes, FKs NOT NULL corretas, CHECK constraints em colunas de status evitando valores arbitrários, índices em toda FK — boa disciplina de integridade referencial em DDL puro.
- **Requirements:** todas as 10 acceptance criteria (DB-01 a DB-10) e os 3 edge cases do spec.md batem campo a campo, tipo a tipo, constraint a constraint com o implementado — zero scope creep, zero SPEC_DEVIATION.
- **Tests:** ausência de testes unitários TypeScript é correta (não há camada de aplicação ainda) — não forçado onde não se aplica.
- **Architecture:** convenção de nomenclatura de índices (`<tabela>_<coluna>_idx`) e triggers (`set_<tabela>_updated_at`) aplicada de forma perfeitamente consistente nas 9 migrations.
- **Regression:** nenhuma FK aponta para tabela não criada no conjunto; função de trigger reutilizada corretamente sem duplicação; nenhum TODO/FIXME.
- **Performance:** índice único parcial `ranking_cache_general_unique` resolve corretamente o gap de `UNIQUE` composto não bloquear múltiplos `NULL`, sem overhead extra.
