# Dashboard — Interview Decisions

**Date:** 2026-07-26
**Scope:** Construir a feature Dashboard em `/home`: cards de gamificação (Money Preserved, Streak, Accuracy, Level, XP), listas de Today's Matches / Upcoming Matches / Latest Predictions, e o shell de navegação (sidebar desktop + tab bar mobile) com 5 links, 4 deles apontando para páginas placeholder. 100% Server Components nesta rodada (sem interatividade real ainda). Referência visual: `bet-free-images/desktop_dash.png`, `m_home.png`, `d_matches.png`, `m_matches.png`, `m_result.png`.
**Source:** Discussão informal (comando `/interview`), com imagens de design fornecidas pelo usuário

---

## Decisões

### Gaps de dados descobertos (pré-existentes ao pedido)

- **Money Preserved, Current Streak, Level, XP** não existem em nenhuma tabela do schema atual — só `predictions.points_earned` (nullable) sugere uma pontuação nunca implementada.
- **Nenhuma feature de criação de palpite existe** (nem UI, nem service, nem action) — "Latest Predictions" e o botão "Make Prediction" (visto nas imagens) não têm backend funcional ainda.
- **Nenhum código provisiona `public.users`** no login — a sessão só valida o Firebase, nunca cria/sincroniza uma linha correspondente no Supabase.
- **RLS é `deny-all`** em todas as tabelas (decisão da feature `sports-provider`) — nenhuma policy de leitura para `anon`/`authenticated`.

### Colunas novas em `users` (migration nova)

- `money_saved NUMERIC(10,2) NOT NULL DEFAULT 0`
- `current_streak INTEGER NOT NULL DEFAULT 0`
- `level INTEGER NOT NULL DEFAULT 1`
- `xp INTEGER NOT NULL DEFAULT 0`
- **Rationale:** dado real (ainda zerado) é mais barato que mock — evita retrabalho quando a lógica de escrita (dar XP, incrementar streak, calcular money_saved) for implementada numa feature futura de "gamification engine"/prediction processing. Esta rodada só lê essas colunas; nada escreve nelas ainda.

### Fórmulas de leitura (cálculo, não persistência de lógica de negócio)

- **Accuracy**: `COUNT(predictions WHERE points_earned > 0) / COUNT(predictions WHERE points_earned IS NOT NULL)`. Predictions de partidas ainda não finalizadas (`points_earned IS NULL`) não contam nem a favor nem contra. Com 0 predictions finalizadas, resultado é 0%/estado vazio.
- **Level/XP progress**: threshold fixo de 3000 XP por nível. `level_calculado = floor(xp_total / 3000) + 1`, `xp_no_nivel_atual = xp_total % 3000`, progresso = `xp_no_nivel_atual / 3000`. (Nota: `users.level` armazenado pode divergir do calculado se a lógica de escrita futura não seguir essa mesma fórmula — resolver quando a feature de gamificação real for desenhada.)
- **Money Preserved**: lido diretamente de `users.money_saved` (`NUMERIC(10,2)`), formatado em reais via `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`. Nenhuma fórmula de cálculo nesta rodada — é um valor já persistido (hoje sempre 0).

### Provisionamento de usuário ausente

- Dashboard é **read-only**: busca `users` por `firebase_uid`; se não encontrar linha, trata como "zero state" (R$0, 0 dias, 0%, nível 1, 0 XP) sem inserir nada no banco.
- **Rationale:** mantém o Dashboard sem side effects. Provisionamento de usuário no primeiro login é responsabilidade conceitual da feature de Auth, fora de escopo aqui.

### Acesso a dados / RLS

- Server Components usam `lib/supabase/admin.ts` (client service-role, já existente) para todas as leituras do Dashboard — bypassa RLS, mesmo padrão já usado pelos services de sync.
- **Rationale:** RLS baseado em `auth.uid()` do Supabase não funciona neste projeto (autenticação é Firebase, não Supabase Auth). Fazer policies reais exigiria lógica de negócio de autorização não desenhada agora.
- **Consequência técnica:** a regra ESLint `no-restricted-imports` que hoje só libera `@/lib/supabase/admin` para `features/sports-sync/services/**` precisa ser estendida para a camada de dados do Dashboard (ex: `features/dashboard/services/**`).

### Escopo do shell de navegação

- Esta rodada **inclui** o shell de navegação completo: sidebar fixa à esquerda (desktop) + tab bar fixa embaixo (mobile), replicando exatamente `desktop_dash.png`/`m_home.png`.
- 5 links: Home (`/home`), Matches, Rankings, Achievements, Profile.
- As 4 rotas além de Home (`/matches`, `/rankings`, `/achievements`, `/profile`) ganham **páginas placeholder simples** ("Em breve") nesta rodada — evita links mortos/404, sem construir as features de verdade.

### Roteamento

- Dashboard vive em **`/home`**, não em `/` — `/` fica reservada para uma landing page futura (fora de escopo), permanecendo inalterada (placeholder atual de `app/page.tsx`).
- Redirecionamento pós-login (hooks `use-login-with-google.ts`, `use-email-password-mutation.ts`) muda o default de `router.push(redirectTo ?? "/")` para `"/home"` — consequência direta de mover o dashboard, não scope creep.

### Interatividade / React Query

- **Nada é interativo nesta rodada.** Dashboard 100% Server Components. O botão "Make Prediction" (visto no design) aparece visualmente mas fica desabilitado/placeholder — a feature de criar palpite não existe ainda.
- **Rationale:** usar React Query onde não há nenhum estado client-side real seria abstração prematura. Reavaliar quando a feature de predictions for construída.

### Componentes reutilizáveis

- `StatCard` genérico (icon, iconClassName, value, label) para Streak/Accuracy/Level — mesmo layout visual nos 3.
- `XpProgressCard` componente separado (level, xp, nextLevelXp) — layout estruturalmente diferente (título+valor no topo, barra de progresso embaixo), não força os 2 formatos dentro de props condicionais de um único componente.
- Hero card de Money Preserved: componente próprio (gradiente, maior, ícone de porquinho) — não é um "stat card" no mesmo padrão dos outros.

### Empty states / copy

- Copy de estados vazios (R$0, streak 0, "nenhum palpite ainda") fica a critério do implementador — tom consistente com o já visto nas imagens (ex: "Every free prediction is money that stays with you"), em pt-BR.

---

## Agent's Discretion

- Copy exato dos estados vazios (Money Preserved zerado, streak zerado, Latest Predictions vazia).
- Nome exato dos arquivos/componentes dentro de `features/dashboard/`.
- Detalhes visuais finos não cobertos pelas imagens (espaçamento exato, breakpoints intermediários).
- Se o botão "Make Prediction" desabilitado deve ter tooltip/toast explicando "em breve" ou só ficar visualmente inativo.

---

## Deferred Ideas

- Lógica de escrita de gamificação (dar XP, incrementar streak, calcular/creditar money_saved) — feature futura de "prediction processing"/gamification engine.
- Feature de criação de palpite ("Make Prediction" funcional) — feature futura.
- Páginas reais de Matches, Rankings, Achievements, Profile (hoje só placeholder "Em breve").
- Landing page em `/`.
- Provisionamento real de `public.users` no primeiro login — feature futura de Auth.
- RLS baseado em autorização real (hoje contornado via service role).

---

## Open Questions

- Nenhuma pendente.
