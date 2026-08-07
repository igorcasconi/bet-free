# Landing Page — Interview Decisions

**Date:** 2026-08-06
**Scope:** Construir uma landing page pública em `/` que explica o propósito do Bet Free (transformar o impulso de apostar em previsões gratuitas gamificadas), destaca o conceito de "Dinheiro Poupado", e tem CTA para acessar a plataforma (`/login`). Não inclui novas features de produto (lógica real de `money_saved`, criação de aposta) — apenas a página de marketing e o necessário para torná-la pública.
**Source:** Discussão informal (sem spec.md prévio)

---

## Decisions

### Estrutura das seções

- Ordem fixa, de cima para baixo:
  1. **Hero** — headline sobre o propósito, subheadline curta, CTA principal
  2. **Como funciona** — 3 passos (faça palpites grátis em jogos reais → ganhe XP/streak → veja o dinheiro preservado)
  3. **Dinheiro Poupado (destaque)** — preview visual do valor poupado em BRL
  4. **Gamificação** — preview de XP/nível/streak
  5. **CTA final** — reforço do botão antes do rodapé
- **Rationale:** cobre propósito → mecânica → prova visual → reforço de conversão, sem seções de prova social/FAQ que ficariam vazias sem dados reais no MVP.

### Rota pública e middleware

- `app/page.tsx` é substituído integralmente pela landing (Server Component, sem `"use client"`); remove o placeholder atual ("Logado como {email}" + `LogoutButton`).
- `"/"` é adicionado a `PUBLIC_PATHS` em `lib/auth/middleware-logic.ts`, liberando acesso anônimo.
- Se o usuário já estiver autenticado e acessar `/`, redireciona automaticamente para `/home`.
- **Rationale:** hoje `/` é bloqueado pelo middleware (só `/login` é público) e mostra um placeholder de teste — nada disso serve para uma landing pública. Redirecionar usuário logado evita mostrar copy de "conheça a plataforma" para quem já é usuário.

### Conteúdo visual

- Hero usa as imagens de referência já presentes em `bet-free-images/` (ex.: `saved-illustration.png`) como ilustração/mood.
- Seções "Dinheiro Poupado" e "Gamificação" reaproveitam os componentes reais do dashboard (`MoneyPreservedCard`, `XpProgressCard`, `StatCard`) com **dados mockados estáticos** (ex.: "R$ 342,00 poupados", "Nível 3", "7 dias de streak").
- **Rationale:** combinação dá riqueza visual no hero sem exigir arte nova, e usa a UI real do produto nas seções de prova — evitando duas fontes visuais divergentes que desatualizariam com o tempo.

### CTA

- Texto: **"Acessar a plataforma"**.
- Dois CTAs idênticos: um no Hero, outro na seção final, antes do rodapé.
- Destino: `/login` (fluxo único existente de login/cadastro com toggle interno).
- **Rationale:** reforça conversão sem exigir scroll de volta, sem a insistência de um CTA sticky no header.

### Tom da copy sobre vício em apostas

- Tom **acolhedor, sem julgamento**, focado em ação positiva e controle — evita repetir palavras pesadas ("vício", "problema", "doença").
- Linguagem de produto: "controle", "escolha consciente", "recompensa alternativa" (ex.: "Sinta a emoção do palpite, sem o risco da aposta").
- Menciona o tema de forma indireta mas identificável para quem precisa se reconhecer (ex.: "Se apostar virou um hábito difícil de controlar...").
- **Rationale:** equilibra a mensagem de apoio com identidade de produto de gamificação, evitando soar como app clínico de saúde mental.

---

## Agent's Discretion

- Nenhuma decisão foi delegada como "você decide" nesta interview — todas as áreas foram fechadas com uma escolha explícita do usuário.

---

## Deferred Ideas

- Seção de depoimentos/prova social — descartada por falta de usuários reais no momento; revisitar quando houver dados.
- Seção de FAQ sobre o app não envolver dinheiro real — útil para tranquilizar céticos, mas considerada pesada para o MVP da landing.
- CTA sticky no header — mais agressivo para conversão, mas descartado por enquanto em favor de dois CTAs (hero + final).
- Tom mais clínico/direto sobre vício (com possíveis links de apoio/recursos externos) — descartado por deslocar o produto para "app de saúde" em vez de gamificação; pode ser revisitado se houver demanda.
- `?mode=sign-up` na URL de `/login` para abrir direto no modo cadastro a partir da landing — não decidido nesta interview; hoje `LoginPage` só lê o param `redirect`, não um param de modo.

---

## Open Questions

- Nenhuma pendência bloqueante identificada.
