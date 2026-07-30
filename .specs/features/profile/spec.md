# Profile Specification

## Problem Statement

A rota `/profile` existe apenas como placeholder ("Em breve") desde que o dashboard foi criado. O usuário não tem hoje nenhuma tela dedicada que reúna seus dados de gamificação (level, XP, accuracy, money saved, streak), identidade (avatar/nome) e histórico recente de previsões — só o dashboard mostra um subconjunto disso, misturado com dados de partidas do dia.

## Proposed Solution

Uma página `/profile` (Server Component, substituindo o placeholder) que exibe: avatar e nome do usuário (com fallback quando ausentes), Level/XP, Accuracy, Money Saved, Current Streak, uma seção de Achievements (empty-state por enquanto) e as últimas 5 previsões — reaproveitando ao máximo os dados e componentes já existentes em `features/dashboard`, com `getAccuracyPercent` extraído para `lib/predictions/accuracy.ts` como ponto compartilhado entre as duas features.

## Goals

- [x] `/profile` deixa de ser placeholder e exibe dados reais do usuário logado
- [x] Nenhuma lógica de cálculo (accuracy, level/XP) é duplicada entre dashboard e profile — ambos consomem a mesma fonte
- [x] Layout responsivo consistente com o padrão já estabelecido no dashboard (stack + grids internos, breakpoints `sm:`/`md:`/`lg:`)

## Out of Scope

| Feature                                                                     | Reason                                                                   |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Provisionamento de `avatar_url`/`display_name`/`email` a partir do Firebase | Deferred na interview — responsabilidade de auth/sync, não desta feature |
| Seed de `achievements` + lógica de desbloqueio                              | Deferred na interview — feature futura                                   |
| Upload de avatar                                                            | Não solicitado; não existe mecanismo de upload no projeto hoje           |
| Aumentar/paginar Recent Predictions além de 5                               | Decisão explícita da interview — mantém o limite já usado no dashboard   |
| Edição de perfil (nome, preferências, etc.)                                 | Fora do pedido original — feature é apenas de exibição                   |

---

## User Stories

### P1: Exibir identidade do usuário (avatar + nome) ⭐ MVP

**User Story**: Como usuário logado, quero ver meu avatar e nome no topo do meu perfil, para confirmar que estou vendo meus próprios dados.

**Why P1**: Elemento central de qualquer tela de perfil; define o cabeçalho da página.

**Acceptance Criteria**:

1. WHEN `users.avatar_url` está preenchido THEN o sistema SHALL exibir a imagem via `AvatarImage`
2. WHEN `users.avatar_url` é `NULL` mas `users.display_name` está preenchido THEN o sistema SHALL exibir `AvatarFallback` com as iniciais do nome
3. WHEN `users.display_name` também é `NULL` THEN o sistema SHALL exibir um fallback genérico (ícone ou iniciais neutras) e um texto de nome tipo "Usuário"
4. WHEN `users.email` é `NULL` THEN o sistema SHALL ocultar a linha de email em vez de mostrar vazio

**Independent Test**: Renderizar a seção de identidade com 3 usuários simulados (todos os campos preenchidos; só display_name; todos NULL) e verificar o fallback correto em cada caso.

---

### P1: Exibir stats de gamificação (Level, XP, Accuracy, Money Saved, Streak) ⭐ MVP

**User Story**: Como usuário, quero ver meu level, XP, accuracy, dinheiro economizado e streak atual no meu perfil, para acompanhar meu progresso.

**Why P1**: Núcleo de dados que a feature existe para exibir; pedido explícito do usuário.

**Acceptance Criteria**:

1. WHEN a página carrega para um usuário existente THEN o sistema SHALL calcular `level`/`xpInLevel`/`xpToNextLevel` via `lib/gamification.ts` (`levelForXp`, `xpInLevelForXp`) a partir de `users.xp` — mesmo padrão do dashboard, nunca lendo `users.level` diretamente
2. WHEN a página carrega THEN o sistema SHALL calcular accuracy via a função compartilhada `getAccuracyPercent` (extraída para `lib/predictions/accuracy.ts`)
3. WHEN a página carrega THEN o sistema SHALL exibir `users.money_saved` e `users.current_streak` diretamente
4. WHEN o usuário não é encontrado (ex: sessão inválida) THEN o sistema SHALL exibir stats zerados, mesmo padrão de `zeroStats()` do dashboard

**Independent Test**: Popular um usuário com xp/money_saved/current_streak/predictions conhecidos; renderizar a página; verificar que os 5 valores exibidos batem com o cálculo esperado.

---

### P1: Exibir Achievements (empty-state) ⭐ MVP

**User Story**: Como usuário, quero ver uma seção de conquistas no meu perfil, mesmo que ainda não tenha nenhuma, para saber que essa funcionalidade existe.

**Why P1**: Pedido explícito do usuário; decisão da interview foi empty-state real (query verdadeira, não mock).

**Acceptance Criteria**:

1. WHEN a página carrega THEN o sistema SHALL fazer uma query real em `user_achievements` para o usuário logado
2. WHEN a query retorna vazio (caso atual, sempre) THEN o sistema SHALL exibir uma mensagem de empty-state (ex: "Nenhuma conquista ainda")
3. WHEN a query retornar linhas no futuro (fora de escopo implementar o desbloqueio, mas o código deve estar preparado) THEN o sistema SHALL listar as conquistas com nome/ícone/descrição de `achievements`

**Independent Test**: Com `user_achievements` vazio (estado real hoje), renderizar a página e verificar a mensagem de empty-state.

---

### P1: Exibir Recent Predictions ⭐ MVP

**User Story**: Como usuário, quero ver minhas últimas previsões no meu perfil, para relembrar o que apostei recentemente.

**Why P1**: Pedido explícito do usuário; reuso direto do dashboard já decidido na interview.

**Acceptance Criteria**:

1. WHEN a página carrega THEN o sistema SHALL reaproveitar `getLatestPredictions`/`LatestPredictionsSection` de `features/dashboard` sem alteração de assinatura (limite de 5, sem paginação)
2. WHEN não há previsões THEN o sistema SHALL exibir o mesmo empty-state já existente no componente reaproveitado

**Independent Test**: Popular um usuário com 0, 1 e 6+ previsões; verificar que a seção sempre mostra no máximo 5, ordenadas por mais recente, e o empty-state quando 0.

---

### P1: Layout responsivo ⭐ MVP

**User Story**: Como usuário em qualquer dispositivo, quero que a página de perfil se adapte à tela, para ter uma boa experiência tanto no celular quanto no desktop.

**Why P1**: Pedido explícito do usuário ("Responsive layout").

**Acceptance Criteria**:

1. WHEN a página é renderizada THEN o sistema SHALL seguir o mesmo padrão estrutural do dashboard: stack único (`flex flex-col gap-6 p-6`) com grids internos por seção
2. WHEN a viewport atinge o breakpoint `sm:` THEN os stat cards SHALL se organizar em múltiplas colunas (mesmo padrão `sm:grid-cols-3` do dashboard)
3. WHEN a viewport atinge o breakpoint `md:` THEN o shell de navegação (sidebar vs bottom nav) SHALL se comportar exatamente como já ocorre em todas as outras páginas (sem lógica nova — `AppShell` já cuida disso)

**Independent Test**: Verificar visualmente (ou via snapshot de largura) que a página não quebra em viewports mobile, tablet e desktop, e que o comportamento do shell de navegação é idêntico ao das demais páginas.

---

## Edge Cases

- WHEN o usuário logado não existe na tabela `users` (edge case análogo ao dashboard) THEN o sistema SHALL exibir a página com stats zerados e seções vazias, sem erro 500
- WHEN `users.money_saved` é `0` THEN o sistema SHALL exibir "R$ 0,00" normalmente, não ocultar a seção
- WHEN `users.display_name` é muito longo THEN o layout SHALL truncar/quebrar graciosamente sem estourar o grid (comportamento padrão de truncamento CSS, sem novo componente)

---

## Requirement Traceability

| Requirement ID | Story                                            | Phase  | Status  |
| -------------- | ------------------------------------------------ | ------ | ------- |
| PROF-01        | P1: Exibir identidade do usuário (avatar + nome) | In Tasks | Done     |
| PROF-02        | P1: Exibir stats de gamificação                  | In Tasks | Done     |
| PROF-03        | P1: Exibir Achievements (empty-state)            | In Tasks | Done     |
| PROF-04        | P1: Exibir Recent Predictions                    | In Tasks | Done     |
| PROF-05        | P1: Layout responsivo                            | In Tasks | Done     |

**Coverage:** 5 total, 5 mapped to tasks, 0 unmapped

---

## Success Criteria

- [x] `/profile` exibe avatar/nome, level/XP, accuracy, money saved, streak, achievements (empty-state) e últimas 5 previsões para um usuário real de teste
- [x] `getAccuracyPercent` existe em `lib/predictions/accuracy.ts` e é importado tanto por dashboard quanto por profile, sem duplicação de lógica
- [x] Página funciona corretamente em viewport mobile e desktop, seguindo os breakpoints já convencionados no projeto
