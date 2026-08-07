# Landing Page Specification

## Problem Statement

Hoje `/` é um placeholder autenticado (`app/page.tsx`) que só mostra "Logado como {email}" e é bloqueado pelo middleware para visitantes anônimos — não existe nenhuma página pública que explique o propósito do Bet Free. Isso impede que novos usuários entendam o produto (transformar o impulso de apostar em previsões gratuitas gamificadas) antes de se cadastrarem.

## Proposed Solution

Uma landing page pública em `/`, acessível sem autenticação, que apresenta o Bet Free em 5 seções (Hero, Como funciona, Dinheiro Poupado, Gamificação, CTA final), reaproveitando os componentes reais do dashboard (`MoneyPreservedCard`, `XpProgressCard`, `StatCard`) com dados mockados como prova visual do produto. Usuários já autenticados que acessam `/` são redirecionados automaticamente para `/home`. Dois CTAs ("Acessar a plataforma") levam para `/login`.

## Goals

- [x] Visitante anônimo consegue acessar `/` sem redirect pro login
- [x] Usuário autenticado que acessa `/` é redirecionado pra `/home` automaticamente
- [x] As 5 seções (Hero, Como funciona, Dinheiro Poupado, Gamificação, CTA final) renderizam corretamente em mobile e desktop
- [x] Ambos os CTAs levam pra `/login`
- [x] Página passa nos testes existentes (build + lint) sem quebrar rotas atuais

## Out of Scope

| Feature                                                  | Reason                                                                 |
| --------------------------------------------------------- | ----------------------------------------------------------------------- |
| SEO / meta tags dedicados (Open Graph, sitemap, etc.)    | Explicitamente adiado pelo usuário — não é foco desta iteração        |
| Lógica real de `money_saved` / criação de aposta         | Fora do escopo — landing usa dados mockados, não integra com backend real |
| Seção de depoimentos/prova social                        | Sem usuários reais ainda; copy ficaria vazia (deferred na interview)   |
| Seção de FAQ sobre "não envolve dinheiro real"           | Considerada pesada para o MVP da landing (deferred na interview)       |
| CTA sticky no header                                     | Descartado em favor de dois CTAs fixos (hero + final)                 |
| `?mode=sign-up` para abrir `/login` direto no modo cadastro | Não decidido; `LoginPage` hoje só lê `redirect`, não um param de modo |
| Tom clínico/direto sobre vício com links de recursos externos | Descartado — foco em produto de gamificação, não app de saúde     |

---

## User Stories

### P1: Acesso público à landing com redirect condicional ⭐ MVP

**User Story**: Como visitante anônimo, quero acessar `/` sem ser redirecionado para o login, para conhecer o Bet Free antes de decidir se cadastrar.

**Why P1**: Sem isso, a landing não existe de fato — hoje o middleware bloqueia `/` para quem não está autenticado.

**Acceptance Criteria**:

1. WHEN um visitante sem sessão válida acessa `/` THEN o sistema SHALL renderizar a landing page (sem redirect para `/login`)
2. WHEN um usuário autenticado acessa `/` THEN o sistema SHALL redirecioná-lo automaticamente para `/home`
3. WHEN `PUBLIC_PATHS` é avaliado em `lib/auth/middleware-logic.ts` THEN `/` SHALL estar incluído na lista de rotas públicas

**Independent Test**: Acessar `/` em aba anônima (sem cookie `__session`) e verificar que a landing renderiza; acessar `/` autenticado e verificar redirect para `/home`.

---

### P1: Hero com propósito e CTA principal ⭐ MVP

**User Story**: Como visitante, quero entender em segundos o que é o Bet Free e ter um caminho claro para acessar a plataforma.

**Why P1**: É o primeiro conteúdo visível — sem isso a página não cumpre a função de landing.

**Acceptance Criteria**:

1. WHEN a landing carrega THEN o sistema SHALL exibir uma headline, subheadline e ilustração (imagem de `bet-free-images/`) na seção Hero
2. WHEN o usuário clica no CTA do Hero ("Acessar a plataforma") THEN o sistema SHALL navegar para `/login`

**Independent Test**: Renderizar a página, verificar presença de headline/subheadline/imagem no Hero e clicar no CTA para confirmar navegação a `/login`.

---

### P2: Seção "Como funciona"

**User Story**: Como visitante, quero entender o passo a passo do produto (palpite grátis → XP/streak → dinheiro preservado) para saber como usar a plataforma.

**Why P2**: Reforça o entendimento após o Hero, mas a página é funcional (MVP) sem ela.

**Acceptance Criteria**:

1. WHEN a seção "Como funciona" renderiza THEN o sistema SHALL exibir os 3 passos (palpites grátis em jogos reais → ganhar XP/streak → visualizar dinheiro preservado)

**Independent Test**: Verificar que os 3 passos aparecem na ordem definida.

---

### P2: Seção "Dinheiro Poupado" com componente real

**User Story**: Como visitante, quero ver como fica o acompanhamento do dinheiro que eu deixaria de perder apostando, para entender o valor concreto do produto.

**Why P2**: É prova visual do produto, mas depende do Hero/CTA já funcionando.

**Acceptance Criteria**:

1. WHEN a seção "Dinheiro Poupado" renderiza THEN o sistema SHALL exibir o componente `MoneyPreservedCard` com um valor mockado em BRL (ex.: "R$ 342,00")

**Independent Test**: Verificar que o card aparece com o valor mockado e o mesmo visual usado no dashboard autenticado.

---

### P2: Seção "Gamificação" com componentes reais

**User Story**: Como visitante, quero ver como funciona a progressão de XP/nível/streak, para entender a recompensa alternativa à aposta.

**Why P2**: Reforça a mecânica de gamificação, complementar ao restante da página.

**Acceptance Criteria**:

1. WHEN a seção "Gamificação" renderiza THEN o sistema SHALL exibir `XpProgressCard` e/ou `StatCard` com dados mockados (ex.: "Nível 3", "7 dias de streak")

**Independent Test**: Verificar presença dos cards com os dados mockados definidos.

---

### P2: CTA final antes do rodapé

**User Story**: Como visitante que leu toda a página, quero um segundo ponto de acesso à plataforma sem precisar rolar de volta ao topo.

**Why P2**: Reforça conversão, mas o Hero já cobre o caminho mínimo de acesso.

**Acceptance Criteria**:

1. WHEN o usuário rola até o final da página THEN o sistema SHALL exibir um segundo CTA idêntico ("Acessar a plataforma") que navega para `/login`

**Independent Test**: Rolar até o final da página, verificar presença do CTA e clicar para confirmar navegação a `/login`.

---

## Edge Cases

- WHEN o middleware falha ao verificar a sessão (erro de rede/Firebase) THEN o sistema SHALL tratar como não autenticado e exibir a landing (fail-open para a landing, não para rotas internas)
- WHEN a viewport é mobile THEN as seções SHALL empilhar verticalmente sem quebra de layout (cards responsivos)
- WHEN as imagens de `bet-free-images/` não carregam THEN o Hero SHALL manter headline/CTA legíveis (imagem não pode ser bloqueante do conteúdo textual)

---

## Requirement Traceability

| Requirement ID | Story                                          | Phase    | Status   |
| --------------- | ----------------------------------------------- | -------- | -------- |
| LAND-01         | P1: Acesso público com redirect condicional     | In Tasks | Done |
| LAND-02         | P1: Hero com propósito e CTA principal          | In Tasks | Done |
| LAND-03         | P2: Seção "Como funciona"                       | In Tasks | Done |
| LAND-04         | P2: Seção "Dinheiro Poupado"                    | In Tasks | Done |
| LAND-05         | P2: Seção "Gamificação"                         | In Tasks | Done |
| LAND-06         | P2: CTA final                                   | In Tasks | Done |

**Coverage:** 6 total, 6 mapped to tasks, 0 unmapped

---

## Success Criteria

- [x] Visitante anônimo acessa `/` sem redirect pro login
- [x] Usuário autenticado é redirecionado de `/` pra `/home`
- [x] As 5 seções renderizam corretamente em mobile e desktop
- [x] Ambos os CTAs levam pra `/login`
- [x] Build e lint passam sem quebrar rotas existentes
