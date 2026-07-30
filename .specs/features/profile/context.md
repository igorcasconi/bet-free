# Profile — Interview Decisions

**Date:** 2026-07-30
**Scope:** Profile é uma página (`/profile`, substituindo o placeholder) que exibe Avatar, Level, XP, Accuracy, Money Saved, Achievements, Current Streak e Recent Predictions do usuário logado, com layout responsivo.
**Source:** Interview interativa (sem spec prévio; rota `/profile` já existe como placeholder desde `.specs/features/dashboard/`)

---

## Decisions

### Avatar / dados de identidade

- `avatar_url`, `display_name`, `email` **nunca são populados hoje** (nenhum código faz upsert desses campos vindos do Firebase) — confirmado por exploração de código.
- Provisionamento desses dados (sincronizar do Firebase pro Postgres) fica **fora de escopo** desta feature.
- Profile apenas lê o que existe em `users` e renderiza fallback gracioso quando `NULL`: avatar usa iniciais do `display_name` (ou ícone genérico se também `NULL`); nome mostra um placeholder tipo "Usuário" quando ausente; email é ocultado quando vazio.
- **Rationale:** misturar provisionamento de auth dentro de uma feature de exibição de perfil expandiria bastante o escopo; é responsabilidade de uma feature de auth/sync separada.

### Achievements

- Seção de Achievements é **empty-state puro** nesta rodada.
- Faz query real em `user_achievements` (hoje sempre retorna vazio, já que não há seed nem lógica de desbloqueio), renderiza mensagem de "nenhuma conquista ainda" quando vazio.
- Sem seed de `achievements`, sem lógica de desbloqueio — deferred para feature futura.

### Reuso de dados do dashboard

- `getLatestPredictions` e os componentes de apresentação (`StatCard`, `XpProgressCard`, `LatestPredictionsSection`, `MoneyPreservedCard`) são reaproveitados via import do barrel `features/dashboard` (API pública já exposta via `index.ts`), sem duplicar lógica.
- `getAccuracyPercent` é **extraído** de `features/dashboard/services/get-dashboard-data.ts` para um local compartilhado: `lib/predictions/accuracy.ts`. Tanto dashboard quanto profile passam a importar dali.
- **Rationale:** accuracy é conceito de domínio de predictions, não de dashboard — agora que 2 features precisam da mesma lógica, atende ao critério do CLAUDE.md de "shared code só quando genuinamente reutilizável entre múltiplos domínios".

### Level / XP — fonte de verdade

- Profile segue o mesmo padrão do dashboard: recalcula `level`/`xpInLevel`/`xpToNextLevel` via `lib/gamification.ts` (`levelForXp`, `xpInLevelForXp`) a partir de `users.xp`, em vez de ler a coluna `users.level` armazenada diretamente.
- **Rationale:** consistência com dashboard e com o próprio `PredictionProcessor` (que já escreve `users.level` usando essa mesma fórmula) — elimina risco de divergência.

### Layout responsivo

- Segue o mesmo padrão já estabelecido no dashboard: stack único (`flex flex-col gap-6 p-6`) com grids internos por seção (ex: `sm:grid-cols-3` para stat cards), sem layout de duas colunas novo.
- Breakpoints já convencionados no projeto continuam válidos: `md:` é o breakpoint do shell de navegação (sidebar vs bottom nav, já tratado pelo `AppShell`), `sm:`/`lg:` para colunas de grid dentro da página.

### Recent Predictions

- Mantém o limite de 5 já existente em `getLatestPredictions`, sem parametrizar/aumentar — reaproveitado sem alteração de assinatura.

---

## Agent's Discretion

- Nenhuma área foi delegada como "você decide" nesta interview — todas as decisões de negócio foram fechadas explicitamente pelo usuário.
- Detalhes puramente de implementação (composição exata de componentes na página, nomes internos de arquivos dentro de `features/profile/`, exato texto de fallback/empty-state) ficam a critério do implementador.

---

## Deferred Ideas

- Provisionamento de `avatar_url`/`display_name`/`email` a partir do Firebase — feature futura de auth/sync.
- Seed de `achievements` + lógica de desbloqueio (baseada em `criteria JSONB`) — feature futura.
- Aumentar/parametrizar o limite de Recent Predictions — não solicitado, mantido em 5.

---

## Open Questions

- Nenhuma pendência bloqueante identificada.
