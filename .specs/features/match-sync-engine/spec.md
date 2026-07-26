# Match Sync Engine Specification

**Context**: `.specs/features/match-sync-engine/context.md`

## Problem Statement

Os 4 services de sync existentes (`features/sports-sync/services/*`) funcionam
isoladamente, mas nada impede que duas execuções do mesmo tipo de sync rodem
ao mesmo tempo (ex: dois crons sobrepostos), e não existe nenhuma rotina que
reconcilie partidas que ficaram "presas" com status desatualizado (partidas
cujo `match_date` já passou mas que `updateLiveMatches` — que só cobre o dia
atual — nunca corrigiu).

## Proposed Solution

`MatchSyncService`, uma classe orquestradora em
`features/sports-sync/services/match-sync-service.ts`, envolve os 4 services
existentes com um lock de execução baseado numa nova tabela `sync_runs` no
Supabase (por tipo de operação, TTL de 10 minutos), e adiciona um 5º método,
`updateFinishedMatches()`, que reconcilia partidas presas via um novo método
dedicado no `SportsProvider` (`eventspastleague.php`). As 4 rotas HTTP
existentes passam a chamar o orquestrador (ganhando o lock); 2 rotas novas
expõem `updateFinishedMatches` e um `runFullSync()` que executa os 5 métodos
em sequência.

## Goals

- [x] Duas execuções do mesmo tipo de sync nunca rodam simultaneamente
      (bloqueadas pela tabela `sync_runs`)
- [x] Partidas com `match_date` passada e status desatualizado são
      reconciliadas automaticamente por `updateFinishedMatches()`
- [x] Todas as 6 rotas HTTP (`app/api/sync/*`) passam pelo lock antes de
      delegar para o service de negócio correspondente

## Out of Scope

| Feature                                                                   | Reason                                                                                      |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Reimplementar syncCompetitions/syncTeams/syncMatches/updateLiveMatches    | Já implementados e revisados na feature `sports-provider` — `MatchSyncService` só orquestra |
| Execução automática real (cron/Vercel Cron)                               | Mesma decisão da feature anterior — só os endpoints precisam existir                        |
| Lock em memória (flag booleana)                                           | Não funciona em ambiente serverless (Vercel) — ver `context.md`                             |
| Ajuste fino do limiar de "partida presa" além de um valor razoável (3-6h) | Agent's Discretion, ver `context.md`                                                        |

---

## User Stories

### P1: Lock Table & Concurrency Guard ⭐ MVP

**User Story**: Como sistema, preciso de um mecanismo de lock persistente
por tipo de operação de sync, para que duas execuções do mesmo tipo nunca
rodem ao mesmo tempo, mesmo em ambiente serverless sem estado compartilhado
em memória.

**Why P1**: É a base de tudo — sem o lock, `MatchSyncService` não tem como
cumprir a responsabilidade central de "prevent duplicated synchronization".

**Acceptance Criteria**:

1. WHEN a migration de `sync_runs` roda THEN o banco SHALL ter colunas `id
UUID`, `type TEXT`, `status TEXT`, `started_at TIMESTAMPTZ`, `finished_at
TIMESTAMPTZ NULL`.
2. WHEN um lock é adquirido para um `type` THEN o sistema SHALL inserir uma
   linha `status='running'`.
3. WHEN já existe uma linha `status='running'` para o mesmo `type` com
   `started_at` há menos de 10 minutos THEN a aquisição do lock SHALL
   falhar (nova execução daquele tipo é rejeitada).
4. WHEN já existe uma linha `status='running'` para o mesmo `type` com
   `started_at` há mais de 10 minutos (stale) THEN a aquisição do lock SHALL
   suceder (nova execução é permitida).
5. WHEN a operação sob lock termina com sucesso THEN a linha SHALL ser
   atualizada para `status='finished'`, `finished_at=now()`.
6. WHEN a operação sob lock lança erro THEN a linha SHALL ser atualizada
   para `status='failed'`, `finished_at=now()`, e o erro SHALL ser
   relançado (nunca capturado silenciosamente).
7. WHEN dois `type`s diferentes tentam adquirir lock ao mesmo tempo THEN
   ambos SHALL suceder (lock é por tipo, não global).

**Independent Test**: Inserir uma linha `running` para `type='matches'`,
tentar adquirir lock de novo para `matches` (deve falhar) e para `live`
(deve suceder); simular `started_at` de 11 minutos atrás e confirmar que a
aquisição para `matches` agora sucede.

---

### P1: MatchSyncService Orchestration of Existing Sync Operations ⭐ MVP

**User Story**: Como sistema, preciso que uma classe orquestradora
(`MatchSyncService`) exponha os 4 métodos de sync já existentes, cada um
protegido pelo lock de execução, para que as rotas HTTP possam delegar
neles sem reimplementar a lógica de negócio já testada.

**Why P1**: É o núcleo do "Match Sync Engine" pedido — sem isso, o lock
existe mas nada o usa.

**Acceptance Criteria**:

1. WHEN `MatchSyncService.syncCompetitions()` é chamado THEN ele SHALL
   adquirir o lock `type='competitions'`, delegar para
   `competitions-sync-service.syncCompetitions()`, e liberar/marcar o lock
   conforme o resultado.
2. WHEN `MatchSyncService.syncTeams()` é chamado THEN o mesmo padrão SHALL
   se aplicar com `type='teams'`, delegando para `teams-sync-service`.
3. WHEN `MatchSyncService.syncMatches()` é chamado THEN o mesmo padrão SHALL
   se aplicar com `type='matches'`, delegando para `matches-sync-service`.
4. WHEN `MatchSyncService.updateLiveMatches()` é chamado THEN o mesmo
   padrão SHALL se aplicar com `type='live'`, delegando para
   `live-matches-sync-service`.
5. WHEN o lock de um `type` não pode ser adquirido (já `running`) THEN o
   método correspondente SHALL lançar um erro específico (ex:
   `SyncAlreadyRunningError`) em vez de tentar rodar o service subjacente.

**Independent Test**: Mockar os 4 services de função e `sync_runs`; chamar
cada método do `MatchSyncService` e confirmar que (a) o lock é adquirido
com o `type` certo, (b) o service de função certo é chamado, (c) chamar de
novo enquanto "running" lança `SyncAlreadyRunningError`.

---

### P1: Update Finished Matches

**User Story**: Como sistema, preciso reconciliar partidas cujo
`match_date` já passou mas que continuam com status `scheduled`/`live`
porque `updateLiveMatches` só cobre o dia atual, para que o banco não
acumule dados presos indefinidamente.

**Why P1**: É a única responsabilidade genuinamente nova pedida (as outras
4 já existem) — núcleo do valor desta feature além do lock.

**Acceptance Criteria**:

1. WHEN `SportsProvider.updateFinishedMatches(externalCompetitionId)` é
   chamado THEN `TheSportsDBProvider` SHALL chamar
   `eventspastleague.php?idLeague={id}` e retornar `ProviderMatch[]`
   normalizado (mesmo formato dos demais métodos).
2. WHEN `features/sports-sync/services/finished-matches-sync-service.ts`
   roda THEN ele SHALL consultar `matches` por linhas com `status IN
('scheduled', 'live')` e `match_date` anterior ao limiar configurado
   (Agent's Discretion, ~3-6h), agrupadas por competição.
3. WHEN esse service processa uma partida presa encontrada na resposta do
   provider THEN ele SHALL fazer `UPDATE` (nunca `INSERT`) de
   `status`/`home_score`/`away_score` na linha existente, identificada por
   `external_id`.
4. WHEN `MatchSyncService.updateFinishedMatches()` é chamado THEN o mesmo
   padrão de lock (`type='finished'`) da story anterior SHALL se aplicar.

**Independent Test**: Inserir 1 partida com `status='live'` e `match_date`
de 2 dias atrás; mockar o provider retornando essa partida como `finished`
com placar; rodar o service e confirmar `UPDATE` sem criar linha nova.

---

### P2: Full Sync Orchestration

**User Story**: Como operador, quero um único método que rode os 5 tipos
de sync em sequência correta, para popular/atualizar o banco do zero numa
única chamada.

**Why P2**: É conveniência sobre as stories P1 — não bloqueia o valor
central (lock + finished matches), mas é útil operacionalmente.

**Acceptance Criteria**:

1. WHEN `MatchSyncService.runFullSync()` é chamado THEN ele SHALL executar,
   em ordem sequencial estrita, `syncCompetitions` → `syncTeams` →
   `syncMatches` → `updateLiveMatches` → `updateFinishedMatches`.
2. WHEN qualquer etapa de `runFullSync()` falha THEN a execução SHALL parar
   imediatamente (não continuar para as etapas seguintes) e o erro SHALL
   propagar.

**Independent Test**: Mockar as 5 chamadas do `MatchSyncService`, confirmar
ordem de invocação; mockar falha na 3ª etapa e confirmar que a 4ª e 5ª
nunca são chamadas.

---

### P2: HTTP Exposure

**User Story**: Como operador, quero acionar cada método via HTTP (rotas
já existentes atualizadas + 2 novas), para popular o banco manualmente ou
via cron externo, com a mesma proteção de segredo já usada.

**Why P2**: É a superfície de acionamento — depende das stories P1
existirem primeiro; sem elas não há o que expor.

**Acceptance Criteria**:

1. WHEN `app/api/sync/{competitions,teams,matches,live}/route.ts` são
   chamadas THEN elas SHALL delegar para `matchSyncService.<método>()` em
   vez do service de função direto, mantendo a checagem de
   `x-sync-secret` já existente.
2. WHEN `app/api/sync/finished/route.ts` (nova) é chamada com o header
   correto THEN ela SHALL chamar `matchSyncService.updateFinishedMatches()`.
3. WHEN `app/api/sync/full/route.ts` (nova) é chamada com o header correto
   THEN ela SHALL chamar `matchSyncService.runFullSync()`.
4. WHEN qualquer uma das 6 rotas recebe um `SyncAlreadyRunningError` do
   orquestrador THEN ela SHALL retornar um status HTTP apropriado (ex:
   `409 Conflict`) em vez do genérico `500`.

**Independent Test**: Repetir os testes já existentes de 401/200/500 para
as 4 rotas atualizadas (devem continuar passando); adicionar teste de 409
quando o lock já está `running`; testes novos para as 2 rotas novas.

---

## Edge Cases

- WHEN duas requisições HTTP para o mesmo tipo de sync chegam quase
  simultaneamente THEN apenas uma SHALL adquirir o lock; a outra SHALL
  receber `409` sem chamar o service subjacente.
- WHEN uma partida "presa" não existe mais na resposta de
  `eventspastleague.php` (ex: foi removida da fonte) THEN o service SHALL
  simplesmente não atualizá-la, sem erro.
- WHEN `runFullSync()` é chamado mas um dos 5 tipos já está `running` por
  outra execução concorrente THEN a etapa correspondente SHALL lançar
  `SyncAlreadyRunningError`, interrompendo o full sync naquele ponto.
- WHEN o TTL de 10 minutos expira exatamente durante uma tentativa de
  aquisição THEN o comportamento SHALL ser determinístico com base em
  `now() - started_at > 10 min` (sem condição de corrida relevante dado o
  volume baixo de execuções).

---

## Requirement Traceability

| Requirement ID | Story                                         | Phase        | Status |
| -------------- | --------------------------------------------- | ------------ | ------ |
| MATCHSYNC-01   | P1: Lock Table & Concurrency Guard            | Implementing | Done   |
| MATCHSYNC-02   | P1: MatchSyncService Orchestration            | Implementing | Done   |
| MATCHSYNC-03   | P1: Update Finished Matches — provider method | Implementing | Done   |
| MATCHSYNC-04   | P1: Update Finished Matches — service         | Implementing | Done   |
| MATCHSYNC-05   | P2: Full Sync Orchestration                   | Implementing | Done   |
| MATCHSYNC-06   | P2: HTTP Exposure                             | Implementing | Done   |

**Coverage:** 6 total, 6 mapped to tasks, 0 unmapped

---

## Success Criteria

- [x] Tabela `sync_runs` aplicada, lock por tipo funcional com TTL de 10min
- [x] `MatchSyncService` expõe os 5 métodos + `runFullSync`, todos
      protegidos por lock
- [x] `updateFinishedMatches` reconcilia partidas presas sem criar linhas
      novas
- [x] As 6 rotas HTTP delegam para `matchSyncService`, retornam `409` em
      caso de lock já `running`
- [x] Nenhuma lógica de negócio dos 4 services existentes foi duplicada ou
      reimplementada
