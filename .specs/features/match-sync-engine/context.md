# Match Sync Engine — Interview Decisions

**Date:** 2026-07-26
**Scope:** Criar `MatchSyncService`, uma classe orquestradora que envolve os 4 services de sync já existentes (`features/sports-sync/services/*`), adiciona a responsabilidade nova de `updateFinishedMatches` (reconciliar partidas "presas" com status desatualizado) e um lock de execução (via tabela `sync_runs` no Supabase) para impedir duas execuções concorrentes do mesmo tipo de sync. Sem UI.
**Source:** Discussão informal (comando `/interview` com argumentos da feature)

---

## Decisões

### Relação com o que já existe

- `MatchSyncService` **não reimplementa** `syncCompetitions`/`syncTeams`/`syncMatches`/`updateLiveMatches` — delega para os services já existentes em `features/sports-sync/services/*`, que já usam upsert + `UNIQUE(external_source, external_id)` para dedup em nível de linha.
- **Rationale:** essas 4 responsabilidades já foram implementadas e revisadas (feature `sports-provider`); reimplementar seria duplicação e risco de divergência.

### updateFinishedMatches — escopo e fonte de dados

- Reconcilia partidas com `status IN ('scheduled', 'live')` cujo `match_date` já passou há mais de um limiar (ex: algumas horas) e que por isso nunca foram corrigidas por `updateLiveMatches` (que só cobre "hoje", via `eventsday.php`).
- Implementado como **novo método `SportsProvider.updateFinishedMatches(externalCompetitionId: string): Promise<ProviderMatch[]>`**, usando o endpoint v1 dedicado `eventspastleague.php?idLeague={id}` do TheSportsDB (mais leve que re-buscar a temporada inteira via `syncMatches`).
- **Rationale:** endpoint dedicado é mais eficiente por chamada; decisão consciente de expandir a interface `SportsProvider` (5º método) em vez de reaproveitar `syncMatches` para esse caso.
- O service correspondente (`features/sports-sync/services/finished-matches-sync-service.ts`) filtra localmente as partidas presas (query no Supabase) e faz upsert apenas de `status`/`home_score`/`away_score` nas partidas existentes — mesmo padrão de "nunca cria linha nova" já usado em `live-matches-sync-service.ts`.

### Lock de execução (prevenção de sync concorrente)

- Nova tabela `sync_runs` no Supabase: `id UUID`, `type TEXT` (`'competitions'|'teams'|'matches'|'live'|'finished'`), `status TEXT` (`'running'|'finished'|'failed'`), `started_at TIMESTAMPTZ`, `finished_at TIMESTAMPTZ`.
- Lock é **por tipo de operação** — duas execuções do mesmo `type` não rodam simultâneas, mas tipos diferentes (ex: `live` a cada minuto vs `matches` 1x por dia) podem rodar em paralelo sem se bloquear.
- **TTL de 10 minutos**: se existe uma linha `running` para aquele `type` com `started_at` há mais de 10 minutos, considera-se stale (processo provavelmente morreu sem finalizar) e uma nova execução é permitida.
- Em caso de erro durante o sync, o orquestrador captura, marca a linha como `failed` (com `finished_at`) e **relança o erro** (nunca captura silenciosamente) — consistente com a decisão já tomada na feature `sports-provider`.
- **Rationale:** lock em memória (flag booleana) não funciona no ambiente real do projeto (Route Handlers em Vercel, serverless, sem estado compartilhado entre invocações) — só uma tabela no banco garante isso de fato.

### Formato do MatchSyncService

- Classe em `features/sports-sync/services/match-sync-service.ts`: `export class MatchSyncService` com métodos `syncCompetitions()`, `syncTeams()`, `syncMatches()`, `updateLiveMatches()`, `updateFinishedMatches()` e `runFullSync()` (executa os 5 em ordem sequencial: competitions → teams → matches → live → finished).
- Cada método aplica o lock via `sync_runs` (adquire, delega para o service de função correspondente, libera/marca resultado) antes de chamar o service já existente.
- **Rationale:** nome pedido explicitamente foi "MatchSyncService" (classe), consistente com o padrão já usado por `SportsProvider`/`TheSportsDBProvider` na mesma feature — e o estado de orquestração do lock casa melhor com uma classe do que um módulo de funções soltas.

### Exposição HTTP

- As 4 rotas existentes (`app/api/sync/{competitions,teams,matches,live}/route.ts`) passam a chamar `matchSyncService.<método>()` em vez do service de função direto — assim ganham o lock de execução, que é exatamente o problema que este orquestrador resolve (sem isso, continuariam vulneráveis a execução concorrente duplicada).
- 2 rotas novas: `app/api/sync/finished/route.ts` e `app/api/sync/full/route.ts` (chama `runFullSync()`).
- Todas as 6 rotas mantêm a mesma proteção já existente (`isValidSyncSecret` / header `x-sync-secret`).

---

## Agent's Discretion

- Nome exato da instância exportada de `MatchSyncService` (ex: `matchSyncService` singleton vs `new MatchSyncService(...)` por chamada) — desde que consuma os services/lock corretamente.
- Limiar exato de "quantas horas após `match_date` uma partida é considerada presa" para `updateFinishedMatches` (algo como 3-6 horas é razoável para a maioria dos esportes; ajustar durante implementação).
- Nome exato das colunas/índices de `sync_runs` além do que já foi especificado.
- Migration numerada seguindo a convenção já usada (`supabase/migrations/`).

---

## Deferred Ideas

- Nenhuma — escopo ficou fechado em: orquestrador + finished matches + lock, sem novas ideias de UI/negócio surgidas fora disso.

---

## Open Questions

- Nenhuma pendente — endpoint `eventspastleague.php` já confirmado via pesquisa de documentação na feature anterior (`sports-provider`).
