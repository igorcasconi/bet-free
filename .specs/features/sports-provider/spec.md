# Sports Provider Abstraction Specification

**Context**: `.specs/features/sports-provider/context.md`

## Problem Statement

O schema Supabase (`.specs/features/database-schema/`) existe mas está vazio —
não há forma automatizada de popular `competitions`, `teams` e `matches` a
partir de uma fonte de dados esportivos real. Sem isso, nenhuma feature de
palpites pode funcionar com dados reais.

## Proposed Solution

Uma abstração `SportsProvider` (interface) desacopla a aplicação de qualquer
API externa específica. `TheSportsDBProvider` é a primeira implementação,
usando o tier gratuito da TheSportsDB (API v1). Services em
`features/sports-sync/` chamam o provider (nunca a UI diretamente) e
persistem os dados normalizados no Supabase via upsert, usando novas colunas
`external_id`/`external_source` para saber o que já foi sincronizado. Route
Handlers admin protegidas por header secreto expõem os 4 métodos de sync
para acionamento manual/por cron externo.

## Goals

- [x] Trocar `TheSportsDBProvider` por outro provider no futuro exige zero
      mudanças em `features/sports-sync/services/*` (só implementar a
      interface `SportsProvider` e trocar 1 linha na factory)
- [x] `competitions`, `teams` e `matches` podem ser populados a partir da API
      real do TheSportsDB sem duplicar registros em execuções repetidas
      (upsert idempotente via `external_id`)
- [x] Nenhum código de UI ou Server Component importa `TheSportsDBProvider`
      diretamente — só os services de `features/sports-sync`

## Out of Scope

| Feature                                                                             | Reason                                                                                       |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Execução automática real (cron/Vercel Cron/GitHub Action)                           | Deferred — só o endpoint que aciona precisa existir nesta rodada, ver `context.md`           |
| Upgrade para API v2 do TheSportsDB (key paga, livescore real)                       | Deferred — v1 é aproximação aceita agora, arquitetura já suporta troca sem mudar a interface |
| UI/Server Components consumindo dados sincronizados (feature `matches` de exibição) | Fora de escopo desta rodada — só a sincronização, não a exibição                             |
| Retry automático / backoff em falhas de API externa                                 | Decisão explícita: falha imediata, sem retry embutido (ver `context.md`)                     |
| Configuração dinâmica de "qual provider está ativo" (env var)                       | YAGNI — só existe 1 provider implementado (ver `context.md`)                                 |

---

## User Stories

### P1: SportsProvider Interface & Normalized DTOs ⭐ MVP

**User Story**: Como desenvolvedor, quero uma interface `SportsProvider` com
DTOs normalizados no vocabulário do nosso domínio, para que qualquer
implementação futura de provider seja intercambiável sem tocar em lógica de
negócio.

**Why P1**: É o contrato central que garante toda a promessa de "trocar
provider sem modificar lógica de negócio" — todas as outras stories dependem
dele existir primeiro.

**Acceptance Criteria**:

1. WHEN a interface `SportsProvider` é definida THEN ela SHALL expor
   exatamente 4 métodos: `syncCompetitions()`, `syncTeams(externalCompetitionId)`,
   `syncMatches(externalCompetitionId, season)`, `updateLiveMatches()`.
2. WHEN qualquer método do `SportsProvider` retorna dados THEN o retorno SHALL
   ser um DTO normalizado no domínio (`ProviderCompetition`, `ProviderTeam`,
   `ProviderMatch`), nunca o shape bruto da API externa.
3. WHEN `TheSportsDBProvider` mapeia `strStatus` da API (ex: "Match Finished",
   "1H", "Not Started") THEN o DTO resultante SHALL conter apenas um dos
   valores `scheduled`/`live`/`finished`/`postponed`/`cancelled`.
4. WHEN um valor de status desconhecido/não mapeado é recebido da API THEN o
   provider SHALL lançar um erro tipado em vez de silenciosamente aceitar um
   status inválido.
5. WHEN `lib/sports-provider/index.ts` é importado THEN ele SHALL exportar
   uma única instância `sportsProvider: SportsProvider` já composta com
   `TheSportsDBProvider` — nenhum outro módulo do projeto SHALL instanciar
   `TheSportsDBProvider` diretamente.

**Independent Test**: Escrever um teste unitário que instancia
`TheSportsDBProvider` com uma resposta de API mockada e verifica que o DTO
retornado bate com o formato normalizado (nunca com os nomes de campo
`strStatus`/`idLeague` etc. da API bruta).

---

### P1: External ID Schema Support

**User Story**: Como sistema, preciso persistir o ID externo de cada
competição/time/partida sincronizada, para que execuções repetidas de sync
não criem duplicatas.

**Why P1**: Bloqueia todas as outras stories de sync — sem isso, não há como
saber se um registro já existe.

**Acceptance Criteria**:

1. WHEN a nova migration roda THEN `competitions`, `teams` e `matches` SHALL
   ter colunas `external_id TEXT` e `external_source TEXT`.
2. WHEN um segundo `INSERT` é feito com o mesmo par `(external_source,
external_id)` na mesma tabela THEN o banco SHALL rejeitar por violação de
   `UNIQUE(external_source, external_id)`.
3. WHEN `external_id`/`external_source` são `NULL` (registro criado
   manualmente, sem origem externa) THEN a constraint UNIQUE SHALL permitir
   múltiplas linhas com `NULL` (comportamento padrão do Postgres).

**Independent Test**: Aplicar a migration, inserir 1 competição com
`external_source='thesportsdb', external_id='4328'`, tentar inserir de novo
com o mesmo par e confirmar rejeição por `unique_violation`.

---

### P1: Sync Services (Competitions, Teams, Matches)

**User Story**: Como sistema, preciso de services que chamem o
`SportsProvider` e persistam os dados no Supabase via upsert, para popular o
banco com dados reais sem duplicar registros.

**Why P1**: É a ponte entre o provider (busca) e o schema (persistência) —
sem isso os dados nunca chegam ao banco.

**Acceptance Criteria**:

1. WHEN `features/sports-sync/services/competitions-sync-service.ts` roda
   THEN ele SHALL chamar `sportsProvider.syncCompetitions()` e fazer upsert
   em `competitions` usando `(external_source, external_id)` como chave de
   conflito, restrito à lista configurável de league IDs.
2. WHEN `features/sports-sync/services/teams-sync-service.ts` roda para uma
   competição já sincronizada THEN ele SHALL chamar
   `sportsProvider.syncTeams(externalCompetitionId)` e fazer upsert em
   `teams`.
3. WHEN `features/sports-sync/services/matches-sync-service.ts` roda para
   uma competição+season já sincronizada THEN ele SHALL chamar
   `sportsProvider.syncMatches(externalCompetitionId, season)`, resolver
   `home_team_id`/`away_team_id` a partir do `external_id` dos times já
   sincronizados, e fazer upsert em `matches`.
4. WHEN um time referenciado por uma partida (`home_team_id`/`away_team_id`)
   ainda não foi sincronizado THEN o service SHALL registrar o erro e pular
   aquela partida específica, sem interromper o restante do sync.
5. WHEN qualquer chamada ao provider lança erro THEN o service SHALL deixar o
   erro propagar (sem retry, sem captura silenciosa) — ver `context.md`.

**Independent Test**: Com um provider mockado retornando 1 competição
conhecida, rodar `competitions-sync-service`, confirmar 1 linha em
`competitions`; rodar de novo e confirmar que continua 1 linha (upsert, não
duplicata).

---

### P2: Live Matches Update (v1 Approximation)

**User Story**: Como sistema, quero atualizar status/placar de partidas em
andamento periodicamente, para que os dados de `matches` reflitam o jogo
real com atraso aceitável (não é live score instantâneo).

**Why P2**: Depende de competitions/teams/matches já sincronizados (P1) —
é uma atualização incremental sobre dados que já existem, não bloqueia o
sync inicial.

**Acceptance Criteria**:

1. WHEN `updateLiveMatches()` é chamado THEN `TheSportsDBProvider` SHALL usar
   endpoints v1 disponíveis na key gratuita (eventos do dia/rodada) para
   aproximar o estado "ao vivo", retornando `ProviderMatch[]` no mesmo
   formato normalizado dos demais métodos.
2. WHEN o service de live update roda THEN ele SHALL fazer upsert apenas de
   `status`, `home_score`, `away_score` e `updated_at` nas partidas já
   existentes (identificadas por `external_id`) — SHALL NOT criar novas
   partidas nesse fluxo (isso é responsabilidade de `syncMatches`).
3. WHEN uma partida retornada por `updateLiveMatches()` não existe ainda em
   `matches` (por `external_id`) THEN o service SHALL ignorá-la e registrar
   um aviso, sem falhar o processo inteiro.

**Independent Test**: Com uma partida já sincronizada, mockar o provider
retornando status `live` e um placar novo para o mesmo `external_id`,
confirmar que o `UPDATE` reflete no banco sem criar linha nova.

---

### P2: Protected Admin Sync Endpoints

**User Story**: Como operador do sistema, quero endpoints HTTP para acionar
cada método de sync manualmente ou via cron externo, protegidos por um
segredo compartilhado, para popular o banco sem expor as rotas publicamente.

**Why P2**: É a forma de acionar os services desta rodada — importante para
testar a arquitetura ponta a ponta, mas não bloqueia a existência do
provider/services em si (P1).

**Acceptance Criteria**:

1. WHEN uma requisição chega em `app/api/sync/{competitions|teams|matches|live}`
   sem o header `x-sync-secret` correto (comparado contra `SYNC_SECRET`, env
   var server-only) THEN a rota SHALL responder `401` sem chamar nenhum
   service.
2. WHEN uma requisição chega com o header correto THEN a rota SHALL chamar o
   service correspondente e retornar um resumo (contagem de registros
   sincronizados) com status `200`.
3. WHEN o service subjacente lança erro THEN a rota SHALL retornar `500` com
   uma mensagem genérica (sem vazar detalhes internos da API externa na
   resposta).

**Independent Test**: `curl` sem header → `401`; `curl` com header errado →
`401`; `curl` com header correto (ambiente local com `SYNC_SECRET` de teste)
→ `200` e efeito observável no banco.

---

## Edge Cases

- WHEN `syncTeams`/`syncMatches` são chamados para um `externalCompetitionId`
  que não existe na API do TheSportsDB THEN o provider SHALL retornar lista
  vazia (não erro), e o service SHALL tratar isso como "nada a sincronizar".
- WHEN a API do TheSportsDB retorna um formato de resposta inesperado
  (campo faltando, tipo errado) THEN o provider SHALL falhar a validação
  (Zod) e lançar erro tipado, em vez de propagar `undefined`/dado corrompido
  para o service.
- WHEN o rate limit do tier gratuito é atingido (resposta 429 ou similar)
  THEN o provider SHALL lançar o mesmo erro tipado de falha — sem retry
  automático (decisão já registrada).
- WHEN dois syncs do mesmo recurso rodam concorrentemente (ex: cron duplicado)
  THEN a constraint `UNIQUE(external_source, external_id)` SHALL evitar
  duplicatas; o segundo upsert conflitante apenas atualiza a linha existente.

---

## Requirement Traceability

| Requirement ID | Story                                                | Phase    | Status |
| -------------- | ---------------------------------------------------- | -------- | ------ |
| SPORTS-01      | P1: SportsProvider Interface & DTOs                  | In Tasks | Done   |
| SPORTS-02      | P1: SportsProvider Interface & DTOs — status mapping | In Tasks | Done   |
| SPORTS-03      | P1: SportsProvider Interface & DTOs — factory        | In Tasks | Done   |
| SPORTS-04      | P1: External ID Schema Support                       | In Tasks | Done   |
| SPORTS-05      | P1: Sync Services — competitions                     | In Tasks | Done   |
| SPORTS-06      | P1: Sync Services — teams                            | In Tasks | Done   |
| SPORTS-07      | P1: Sync Services — matches                          | In Tasks | Done   |
| SPORTS-08      | P2: Live Matches Update                              | In Tasks | Done   |
| SPORTS-09      | P2: Protected Admin Sync Endpoints                   | In Tasks | Done   |

**Coverage:** 9 total, 9 mapped to tasks, 0 unmapped

---

## Success Criteria

- [x] `SportsProvider` interface e `TheSportsDBProvider` implementados em
      `lib/sports-provider/`, nunca importados fora de
      `features/sports-sync/services/`
- [x] Migration adicionando `external_id`/`external_source` aplicada em
      `competitions`, `teams`, `matches`
- [x] Os 3 services de sync (competitions/teams/matches) fazem upsert
      idempotente comprovável (rodar 2x não duplica)
- [x] `updateLiveMatches()` atualiza partidas existentes sem criar novas
- [x] 4 Route Handlers admin protegidas por `x-sync-secret`, retornando
      401 sem o header correto
- [x] Nenhuma referência a `TheSportsDBProvider` fora de `lib/sports-provider/`
      e da factory em `lib/sports-provider/index.ts`

## TODOs (Open Questions do context.md)

- [ ] Validar contra a resposta real da API (não só a documentação) o
      endpoint v1 exato para "teams por liga" e para "eventos do
      dia/rodada" usado em `updateLiveMatches` — pode exigir ajuste fino
      durante a implementação.
