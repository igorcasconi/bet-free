# Matches Feature — Interview Decisions

**Date:** 2026-07-29
**Scope:** Página `/matches` exibindo partidas de hoje e futuras, agrupadas por competição, com cards mostrando competição, times, horário, status de predição e CTA "Predict", usando React Query e pronta para paginação.
**Source:** Informal discussion (feature nova, sem spec.md anterior)

---

## Decisions

### Arquitetura de fetching

- Server Component (`app/(app)/matches/page.tsx`) busca dados iniciais: partidas de hoje + primeira página de próximas, já agrupadas por competição.
- Dados são hidratados no cache do React Query via `dehydrate`/`HydrationBoundary` (padrão Next.js App Router + TanStack Query).
- Client Components consomem o cache hidratado e assumem paginação subsequente via `useInfiniteQuery`.
- **Rationale:** Segue a decision tree do CLAUDE.md (Server Component para carga inicial/SEO, React Query para paginação/interatividade client) e reaproveita o padrão já validado no dashboard.

### Paginação × agrupamento por competição

- Seção "Hoje" carrega tudo de uma vez (sem paginação) — volume esperado baixo, cabe numa tela.
- Seção "Próximos" pagina via `useInfiniteQuery`, cursor por `match_date` + `id`.
- Cada página traz N partidas já agrupadas por competição no resultado; um grupo de competição pode se repetir entre páginas se a competição tiver jogos em datas espalhadas.
- **Rationale:** Simplicidade — evita múltiplas queries paralelas por competição (uma por grupo), que multiplicaria estado e complexidade sem necessidade real para o pedido atual.

### Status de predição do usuário

3 estados, derivados de `matches.status` + existência de row em `predictions` (sem depender de `points_earned`, que fica fora de escopo):

| Condição                                                | Badge                                                        | CTA               |
| ------------------------------------------------------- | ------------------------------------------------------------ | ----------------- |
| `status='scheduled'` + sem row em `predictions`         | "Sem palpite"                                                | "Predict" (ativa) |
| `status='scheduled'` + com row em `predictions`         | "Palpite feito"                                              | "Editar palpite"  |
| `status` in (`live`,`finished`,`postponed`,`cancelled`) | "Ao vivo"/"Encerrado"/"Adiado"/"Cancelado" (conforme status) | CTA desabilitada  |

- Requer novo join contra `predictions` filtrado pelo `user_id` do usuário logado (via `getCurrentFirebaseUid()`), que hoje não existe em nenhum lugar do código (dashboard hardcoda `hasPrediction: false`).
- Exibição de pontos ganhos (`points_earned`) fica fora do card — pertence à tela de resultados/ranking.

### Timezone do "hoje"

- Corrigir o bug conhecido do dashboard (limite calculado em UTC, causando classificação errada perto da meia-noite BRT).
- Nova função `getBrazilDayBounds()` usando `Intl.DateTimeFormat` com `timeZone: "America/Sao_Paulo"`, substituindo o padrão `getUtcDayBounds()` do dashboard nesta feature.
- **Rationale:** Produto é focado no Brasil; fix é pequeno e evita herdar um bug conhecido numa feature nova. Não corrige o dashboard em si (fora de escopo).

### Sistema visual do badge de status

Reusar variantes existentes do componente `Badge` (sem novos tokens de cor):

| `matches.status` | Variant       | Label       |
| ---------------- | ------------- | ----------- |
| `scheduled`      | `outline`     | "Agendado"  |
| `live`           | `destructive` | "Ao vivo"   |
| `finished`       | `secondary`   | "Encerrado" |
| `postponed`      | `ghost`       | "Adiado"    |
| `cancelled`      | `ghost`       | "Cancelado" |

- **Rationale:** Design atual é grayscale/neutro (OKLCH); introduzir cores semânticas novas (verde/vermelho) expandiria escopo de design não pedido.

### Acesso a dados (RLS vs admin client)

- Novo service em `features/matches/services/**` usa `supabaseAdmin` (mesmo client admin de dashboard/sports-sync).
- Adicionar `features/matches/services/**/*.ts` à whitelist de `no-restricted-imports` em `eslint.config.mjs`, junto com as entradas já existentes para `features/dashboard/services/**` e `features/sports-sync/services/**`.
- **Rationale:** Consistência com padrão já estabelecido; evita depender de policies RLS ainda não verificadas/criadas para leitura de predictions do usuário logado.

### Localização das query keys

- Usar o arquivo real `config/query-keys.ts` (atualmente vazio) para adicionar `QUERY_KEYS.MATCHES`.
- CLAUDE.md documenta `constants/query-keys.ts`, que não existe — discrepância sinalizada, não corrigida nesta feature (ver Open Questions).

---

## Agent's Discretion

- Nenhuma decisão foi explicitamente delegada como "você decide" nesta interview — todas as áreas tiveram escolha explícita do usuário.
- Detalhes de implementação não cobertos na interview (nomes exatos de componentes/hooks, tamanho de página da paginação, estrutura exata do cursor) ficam a critério do implementador, mantendo consistência com as decisões acima.

---

## Deferred Ideas

- Exibição de pontos ganhos (`points_earned`) no card de partida — pertence à tela de resultados/ranking, fora do escopo desta feature.
- Correção do bug de timezone (UTC vs BRT) no dashboard existente — só corrigido dentro da feature Matches, não retroativamente no dashboard.
- Detecção de timezone por preferência do usuário (ao invés de fixar `America/Sao_Paulo`) — exigiria guardar preferência de usuário, fora de escopo.
- Paginação por competição individual (cada grupo com sua própria página) — descartada em favor da paginação simples da seção "Próximos".
- Novo sistema de cores semânticas para status de partida (live/finished etc) — descartado em favor de reuso das variantes existentes do Badge.

---

## Open Questions

- Discrepância entre CLAUDE.md (`constants/query-keys.ts`) e o arquivo real (`config/query-keys.ts`) não foi corrigida — decidido usar o arquivo real, mas a doc do projeto permanece desatualizada. Pode valer a pena atualizar o CLAUDE.md num momento separado (fora do escopo desta feature).
- Policies RLS atuais (`00000000000010_enable_rls.sql`) não foram totalmente auditadas quanto a leitura pública/anônima de `matches`/`competitions`/`teams`/`predictions` — não bloqueante, pois a decisão foi usar admin client, mas fica registrado caso se queira migrar para RLS no futuro.
