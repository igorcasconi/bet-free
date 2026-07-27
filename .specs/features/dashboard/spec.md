# Dashboard Specification

**Context**: `.specs/features/dashboard/context.md`

## Problem Statement

O app não tem nenhuma tela pós-login além de um placeholder simples
("Logado como X" + logout). Não existe navegação, não existe visão
consolidada do progresso do usuário (dinheiro preservado, sequência de
dias, acerto, nível/XP), nem lista de partidas de hoje/futuras. Sem isso,
o produto não tem uma "casa" real para o usuário depois de logar.

## Proposed Solution

Uma nova rota `/home` com: shell de navegação (sidebar desktop / tab bar
mobile), hero card de "Money Preserved", 3 stat cards (Streak, Accuracy,
Level) + 1 card de progresso de XP, e 3 listas (Today's Matches, Upcoming
Matches, Latest Predictions). Tudo Server Components, lendo dados reais do
Supabase via client service-role. 4 rotas de navegação (Matches, Rankings,
Achievements, Profile) recebem páginas placeholder simples.

## Goals

- [x] Usuário logado acessa `/home` e vê dados reais (ainda que zerados)
      de money_saved/streak/accuracy/level/XP
- [x] Today's Matches e Upcoming Matches mostram partidas reais já
      sincronizadas no banco
- [x] Navegação (sidebar/tab bar) funciona nas 5 rotas sem 404
- [x] Design visualmente fiel às referências (`desktop_dash.png`, `m_home.png`)

## Out of Scope

| Feature                                                        | Reason                                                                           |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Lógica de escrita de gamificação (dar XP, streak, money_saved) | Feature futura de "prediction processing"/gamification engine — ver `context.md` |
| Criação de palpite ("Make Prediction" funcional)               | Feature futura — botão fica desabilitado/placeholder                             |
| Páginas reais de Matches, Rankings, Achievements, Profile      | Só placeholder "Em breve" nesta rodada                                           |
| Landing page em `/`                                            | Fora de escopo — `/` fica inalterada                                             |
| Provisionamento real de `public.users` no primeiro login       | Feature futura de Auth — Dashboard só lê, trata ausência como zero state         |
| RLS baseado em autorização real (auth.uid())                   | Não se aplica — auth é Firebase; usa service role, ver `context.md`              |
| React Query / interatividade client-side                       | Nada genuinamente interativo nesta rodada — 100% Server Components               |

---

## User Stories

### P1: Data Layer & Schema Foundation ⭐ MVP

**User Story**: Como sistema, preciso de colunas novas em `users`
(money_saved, current_streak, level, xp) e de uma camada de leitura
service-role, para que o Dashboard tenha de onde ler dados reais (mesmo
que zerados).

**Why P1**: Bloqueia todas as outras stories — sem isso não há dado real
para nenhum card.

**Acceptance Criteria**:

1. WHEN a migration roda THEN `users` SHALL ter `money_saved NUMERIC(10,2)
NOT NULL DEFAULT 0`, `current_streak INTEGER NOT NULL DEFAULT 0`, `level
INTEGER NOT NULL DEFAULT 1`, `xp INTEGER NOT NULL DEFAULT 0`.
2. WHEN o Dashboard busca dados do usuário THEN a query SHALL usar
   `lib/supabase/admin.ts` (service role), nunca o client anon.
3. WHEN o usuário logado (via `firebase_uid`) não tem linha em `users`
   THEN o Dashboard SHALL renderizar valores zerados sem inserir nada no
   banco.
4. WHEN a regra ESLint `no-restricted-imports` é avaliada THEN ela SHALL
   permitir `@/lib/supabase/admin` também em `features/dashboard/services/**`
   (estendendo a exceção já existente para `features/sports-sync/services/**`).

**Independent Test**: Aplicar a migration num banco de teste; consultar
`users` por um `firebase_uid` inexistente e confirmar que a camada de
dados retorna `null`/valores default sem lançar erro nem inserir linha.

---

### P1: Navigation Shell (Sidebar + Bottom Tab Bar)

**User Story**: Como usuário logado, quero uma navegação persistente
(sidebar no desktop, tab bar no mobile) com 5 seções, para me mover pelo
app de forma consistente com o design de referência.

**Why P1**: É o "chassi" visual de toda a experiência pós-login — sem
isso o Dashboard fica solto, sem o contexto do app mostrado nas imagens.

**Acceptance Criteria**:

1. WHEN a viewport é desktop (`md:` ou maior) THEN a navegação SHALL
   renderizar como sidebar fixa à esquerda com os 5 links (Home, Matches,
   Rankings, Achievements, Profile), replicando `desktop_dash.png`.
2. WHEN a viewport é mobile THEN a navegação SHALL renderizar como tab bar
   fixa na parte inferior com os mesmos 5 links, replicando `m_home.png`.
3. WHEN o usuário está em `/home` THEN o item "Home" SHALL aparecer
   visualmente ativo/destacado.
4. WHEN o usuário clica em Matches/Rankings/Achievements/Profile THEN a
   navegação SHALL levar a uma página placeholder ("Em breve") — SHALL NOT
   resultar em 404.

**Independent Test**: Renderizar o layout em viewport desktop e mobile
(via devtools/Playwright), confirmar troca de variante no breakpoint
correto; clicar nos 4 links placeholder e confirmar renderização sem erro.

---

### P1: Gamification Stat Cards

**User Story**: Como usuário logado, quero ver meu Money Preserved,
Current Streak, Accuracy e Level/XP em cards visuais na Home, para
acompanhar meu progresso no app.

**Why P1**: É o núcleo do pedido original — os 5 primeiros itens da lista.

**Acceptance Criteria**:

1. WHEN a página `/home` renderiza THEN ela SHALL exibir um hero card de
   "Money Preserved" com `users.money_saved` formatado como moeda BRL
   (`Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`).
2. WHEN a página renderiza THEN ela SHALL exibir 3 `StatCard` (componente
   reutilizável: icon, iconClassName, value, label) para Current Streak,
   Accuracy e Level, lendo `users.current_streak`, accuracy calculada (ver
   AC4), e `users.level`.
3. WHEN a página renderiza THEN ela SHALL exibir um `XpProgressCard`
   (componente separado) mostrando `xp atual no nível / 3000`, calculado
   como `xp_total % 3000`, com nível calculado como
   `floor(xp_total / 3000) + 1`.
4. WHEN accuracy é calculada THEN a fórmula SHALL ser `COUNT(predictions
WHERE points_earned > 0) / COUNT(predictions WHERE points_earned IS NOT
NULL)` para o usuário logado — predictions com `points_earned IS NULL`
   (partida não finalizada) SHALL NOT contar no denominador.
5. WHEN o usuário não tem nenhuma prediction com `points_earned` preenchido
   THEN accuracy SHALL exibir `0%` (sem divisão por zero).

**Independent Test**: Com um `users` de teste (`money_saved=4380,
current_streak=23, level=14, xp=2340`), confirmar que os cards mostram
"R$ 4.380,00", "23 dias", nível 14, e barra de XP com "2340/3000". Com 0
predictions, confirmar accuracy "0%" sem erro.

---

### P1: Today's Matches & Upcoming Matches

**User Story**: Como usuário logado, quero ver as partidas de hoje e as
próximas partidas na Home, para saber em quais posso (futuramente) fazer
palpites.

**Why P1**: Dados já existem em `matches` (sincronizados pela feature
`sports-provider`) — é a parte do Dashboard com menor gap de dados.

**Acceptance Criteria**:

1. WHEN a página renderiza THEN "Today's Matches" SHALL listar `matches`
   com `match_date` na data de hoje, ordenadas por horário, mostrando
   competição, horário, times (nome + iniciais/avatar) e um botão "Make
   Prediction" desabilitado.
2. WHEN a página renderiza THEN "Upcoming Matches" SHALL listar `matches`
   com `match_date` futura (após hoje), mesma estrutura visual.
3. WHEN não há partidas para hoje/futuras THEN a seção correspondente
   SHALL exibir um estado vazio (copy a critério do implementador), SHALL
   NOT quebrar ou ficar em branco sem explicação.

**Independent Test**: Com matches de teste em datas variadas, confirmar
que "hoje" e "futuras" são segmentadas corretamente; com 0 matches,
confirmar estado vazio renderizado.

---

### P2: Latest Predictions

**User Story**: Como usuário logado, quero ver meus palpites mais
recentes na Home, para acompanhar meu histórico — mesmo que hoje esteja
sempre vazio (feature de criar palpite ainda não existe).

**Why P2**: Pedido explicitamente, mas de valor prático zero até a
feature de criação de palpite existir — a seção sempre renderizará vazia
por ora.

**Acceptance Criteria**:

1. WHEN a página renderiza THEN "Latest Predictions" SHALL consultar
   `predictions` do usuário logado ordenadas por `created_at` desc
   (limitado a N mais recentes).
2. WHEN não há predictions (caso atual de todo usuário) THEN a seção
   SHALL exibir um estado vazio claro, sem erro.

**Independent Test**: Com 0 predictions no banco, confirmar renderização
do estado vazio sem exceção.

---

### P2: Placeholder Routes

**User Story**: Como usuário logado, quero que os links de Matches,
Rankings, Achievements e Profile levem a alguma página (mesmo que
mínima), para não encontrar 404 ao navegar.

**Why P2**: Suporta a Navigation Shell (P1) — sem isso os links quebrariam.

**Acceptance Criteria**:

1. WHEN o usuário acessa `/matches`, `/rankings`, `/achievements`, ou
   `/profile` THEN cada rota SHALL renderizar uma página mínima (título +
   "Em breve"), protegida pela mesma sessão do restante do app.

**Independent Test**: Navegar diretamente para cada uma das 4 URLs e
confirmar renderização sem 404, com o usuário autenticado.

---

## Edge Cases

- WHEN o usuário Firebase autenticado não tem linha em `public.users`
  THEN o Dashboard SHALL renderizar zero state completo (todos os 5 stats
  zerados) sem lançar erro nem escrever no banco.
- WHEN `users.xp` é exatamente um múltiplo de 3000 (ex: 6000) THEN o
  cálculo de nível/progresso SHALL tratar isso como XP-no-nível-atual = 0
  (início do nível seguinte), não como erro de divisão.
- WHEN não há nenhuma partida sincronizada ainda (banco recém-populado)
  THEN Today's/Upcoming Matches SHALL mostrar estado vazio, não erro.
- WHEN o redirect pós-login aponta pra `/home` THEN os 2 hooks de login
  (Google + email/senha) SHALL usar `"/home"` como default em vez de `"/"`.

---

## Requirement Traceability

| Requirement ID | Story                                  | Phase        | Status |
| -------------- | -------------------------------------- | ------------ | ------ |
| DASH-01        | P1: Data Layer & Schema Foundation     | Implementing | Done   |
| DASH-02        | P1: Navigation Shell                   | Implementing | Done   |
| DASH-03        | P1: Gamification Stat Cards            | Implementing | Done   |
| DASH-04        | P1: Today's Matches & Upcoming Matches | Implementing | Done   |
| DASH-05        | P2: Latest Predictions                 | Implementing | Done   |
| DASH-06        | P2: Placeholder Routes                 | Implementing | Done   |

**Coverage:** 6 total, 6 mapped to tasks, 0 unmapped

---

## Success Criteria

- [x] Migration aplicada com as 4 colunas novas em `users`
- [x] `/home` renderiza hero card + 3 stat cards + XP progress + 3 listas,
      com dado real (mesmo que zerado)
- [x] Sidebar (desktop) e tab bar (mobile) funcionais nas 5 rotas
- [x] 4 rotas placeholder sem 404
- [x] Redirect pós-login aponta para `/home`
- [x] Zero uso de React Query nesta rodada (nada genuinamente interativo)
- [x] Visual fiel às imagens de referência fornecidas
