# Sports Provider Abstraction — Interview Decisions

**Date:** 2026-07-26
**Scope:** Criar a abstração `SportsProvider` (interface) + implementação `TheSportsDBProvider`, com os métodos `syncCompetitions()`, `syncTeams()`, `syncMatches()`, `updateLiveMatches()`. Consumida apenas via services (nunca exposta à UI). Arquitetura pronta para outro provider no futuro sem modificar lógica de negócio.
**Source:** Discussão informal (comando `/interview` com argumentos da feature)

---

## Decisões

### Localização do código

- Provider (interface + implementação): `lib/sports-provider/` — infraestrutura de integração externa, mesma categoria de `lib/firebase/` e `lib/supabase/`, não é domínio de negócio.
  - `lib/sports-provider/types.ts` — interface `SportsProvider` + DTOs normalizados
  - `lib/sports-provider/thesportsdb-provider.ts` — implementação `TheSportsDBProvider`
  - `lib/sports-provider/index.ts` — factory, exporta a instância ativa do provider
- Services (chamam o provider e persistem no Supabase): `features/sports-sync/services/` — feature nova, dedicada à sincronização, separada da futura feature `matches` (que será sobre consultar/exibir dados já sincronizados para o usuário final).
- **Rationale:** sincronização com fonte externa é uma responsabilidade distinta de exibição de partidas para o usuário — evita misturar lógica de admin/cron com a feature de usuário final.

### Shape de retorno do provider

- Todos os métodos do `SportsProvider` retornam DTOs normalizados no vocabulário do nosso domínio (ex: `ProviderCompetition { externalId, name, slug, season }`, `ProviderTeam`, `ProviderMatch { externalId, status: 'scheduled'|'live'|'finished'|'postponed'|'cancelled', ... }`), nunca o shape bruto da API externa.
- **Rationale:** é o que garante trocar de provider sem mexer em services — se o provider vazasse o shape do TheSportsDB, um novo provider teria que imitar esse shape exato.

### Fetch vs persist (separação de responsabilidade)

- O **provider** só busca e normaliza dados da API externa — não toca no Supabase.
- O **service** (`features/sports-sync/services/*`) chama o provider E faz upsert no Supabase.
- **Rationale:** mantém o provider como pura integração externa (SRP); troca de provider nunca precisa tocar em código de persistência.

### Mapeamento de status

- A tradução de status livre da API (`strStatus` do TheSportsDB, ex: "Match Finished", "1H", "Not Started") para o vocabulário do domínio (`scheduled`/`live`/`finished`/`postponed`/`cancelled`) acontece **dentro do `TheSportsDBProvider`**, na normalização para o DTO.
- **Rationale:** consequência direta da decisão de DTOs normalizados — services nunca conhecem o vocabulário de nenhum provider específico.

### TheSportsDB — tier e API

- Free tier, API key de teste `"3"` (API v1, `https://www.thesportsdb.com/api/v1/json/{key}/...`), configurável via env var — trocar para key paga no futuro é só mudar env var, sem tocar em código.
- Endpoints v1 relevantes (confirmados via Context7/docs oficiais):
  - `all_leagues.php` — lista de ligas (para `syncCompetitions`)
  - `lookup_all_teams.php?id={idLeague}` (ou endpoint equivalente v1 de teams por liga) — para `syncTeams`
  - `eventsseason.php?id={idLeague}&s={season}` — para `syncMatches`
  - Sem endpoint de livescore real na v1/free tier — `getlivescoresbysport`/`getalllivescores` são **API v2**, que normalmente exige key paga (Patreon).
- **`updateLiveMatches()`** implementado como aproximação via endpoints v1 disponíveis na key gratuita (ex: buscar eventos do dia/rodada via `eventsday.php` ou `eventsround.php` e comparar status/placar) — não é live score instantâneo real, é "quase live" via polling periódico. Limitação conhecida e documentada; trocar para v2 real quando/se a key paga for adotada, sem mudar a interface do `SportsProvider`.

### Parâmetros dos métodos

- `syncCompetitions(): Promise<ProviderCompetition[]>` — sem parâmetro, busca a lista configurada de ligas (ver abaixo).
- `syncTeams(externalCompetitionId: string): Promise<ProviderTeam[]>` — recebe o external id da competição; o service itera sobre as competições já sincronizadas (tabela `competitions`) e chama uma vez por competição.
- `syncMatches(externalCompetitionId: string, season: string): Promise<ProviderMatch[]>` — idem, mais a season.
- `updateLiveMatches(): Promise<ProviderMatch[]>` — sem parâmetro (busca ao vivo é global/por esporte, não por competição específica nesta implementação v1).
- **Rationale:** mantém "quais competições acompanhar" como decisão do service/banco, não hardcoded dentro do provider.

### Escopo de competições sincronizadas

- `syncCompetitions()` itera sobre uma **lista configurável de league IDs** (env var ou arquivo de config), não busca todas as ligas de todos os esportes do mundo.
- **Rationale:** evita popular o banco com milhares de competições irrelevantes e evita estourar rate limit do tier gratuito.

### external_id no schema (gap identificado)

- O schema Supabase já existente (`.specs/features/database-schema/`) **não tem** coluna para guardar o ID externo do provider — sem isso, o service não consegue fazer upsert determinístico.
- **Decisão:** nova migration adicionando `external_id TEXT` e `external_source TEXT` (ex: `'thesportsdb'`) em `competitions`, `teams` e `matches`, com `UNIQUE(external_source, external_id)` por tabela.
- **Rationale:** se outro provider for adicionado depois, os dois provedores coexistem sem colisão de ID (mesma competição vinda de 2 fontes diferentes gera 2 linhas — aceitável, já que hoje só há 1 provider ativo).

### Cliente HTTP

- `fetch` nativo (sem nova dependência), parsing/validação da resposta com Zod (já uma dependência do projeto).
- **Rationale:** alinhado com "less is more" das convenções globais — evita dependência nova para um caso de uso pequeno.

### Erro / retry

- Falha imediata, sem retry automático embutido no provider — lança um erro tipado (ex: `SportsProviderError`) na primeira falha; o service deixa propagar.
- **Rationale:** simplicidade agora; se o gatilho for cron externo, o próprio cron re-executa no próximo ciclo. Evita lógica de retry/backoff prematura antes de conhecer a taxa real de falha da API gratuita.

### Factory do provider ativo

- `lib/sports-provider/index.ts` exporta uma instância única já composta: `export const sportsProvider: SportsProvider = new TheSportsDBProvider(...)`. Services importam `sportsProvider` do index, nunca a classe concreta diretamente.
- Sem env var de "qual provider está ativo" nesta rodada — só existe 1 provider; trocar depois é mudar essa linha, sem tocar em services.
- **Rationale:** YAGNI — configuração dinâmica de provider é over-engineering com apenas 1 implementação.

### Gatilho de execução

- Route Handlers admin em `app/api/sync/*` (ex: `app/api/sync/competitions/route.ts`), uma por método de sync, chamando o service correspondente.
- Execução real (cron job, Vercel Cron, GitHub Action) fica **fora desta rodada** — só o endpoint que aciona precisa existir para a arquitetura estar completa e testável manualmente.
- **Proteção:** header secreto compartilhado (`x-sync-secret`), comparado contra uma env var server-only (`SYNC_SECRET`). Não usa o middleware de sessão Firebase (que é para usuários finais, não para jobs de sync/cron).

---

## Agent's Discretion

- Nomes exatos de arquivos dentro de `lib/sports-provider/` e `features/sports-sync/services/`, desde que sigam a convenção geral do projeto.
- Estrutura exata dos DTOs (`ProviderCompetition`, `ProviderTeam`, `ProviderMatch`) — campos mínimos necessários para popular as colunas do schema existente.
- Nome exato da env var de lista de league IDs (ex: `SPORTS_PROVIDER_LEAGUE_IDS`).
- Detalhes do endpoint v1 exato usado para `syncTeams`/`updateLiveMatches` (a documentação lista variações — ex: `lookup_all_teams.php` vs `lookupteam.php`; validar durante implementação contra resposta real da API).

---

## Deferred Ideas

- Execução automática (cron real / Vercel Cron / GitHub Action) dos endpoints de sync — fica para uma rodada futura.
- Upgrade para API v2 do TheSportsDB (key paga) para livescore real — documentado como melhoria futura, sem mudar a interface do `SportsProvider`.
- UI/Server Components consumindo os dados sincronizados (feature `matches` de exibição) — fora de escopo desta rodada.

---

## Open Questions

- Endpoint v1 exato para "teams por liga" e para "eventos do dia/rodada" (usado em `updateLiveMatches`) precisa ser validado contra a resposta real da API durante a implementação — a documentação disponível descreve o comportamento mas não garante 100% o path exato para a key gratuita.
