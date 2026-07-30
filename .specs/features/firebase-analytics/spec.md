# Firebase Analytics Specification

## Problem Statement

O projeto já depende do pacote `firebase` (v12.16.0) e usa Firebase Auth para login, mas Firebase Analytics nunca foi inicializado — `getAnalytics`/`logEvent` não existem em nenhum lugar do código, e `measurementId` sequer está configurado. Sem instrumentação, não há visibilidade sobre engajamento (logins, previsões criadas, acertos/erros, navegação entre páginas).

## Proposed Solution

Configurar o Firebase Analytics client SDK (adicionando `measurementId` à config existente) e instrumentar 7 eventos de produto em seus pontos de disparo corretos — todos client-side, já que o SDK de Analytics não roda em contexto server/cron. Prediction Won/Lost dispara quando o usuário vê o resultado de uma previsão já resolvida (não quando o cron a processa), com de-duplicação via `localStorage`. Achievement Unlocked fica fora desta rodada por não ter lógica de desbloqueio implementada ainda.

## Goals

- [x] Firebase Analytics inicializa corretamente em produção (client-side, condicionalmente ao suporte do ambiente)
- [x] Cada um dos 7 eventos em escopo dispara exatamente uma vez por ocorrência real, nunca duplicado por reload/re-render
- [x] Nenhuma mudança visual é introduzida na UI — instrumentação é inteiramente invisível ao usuário

## Out of Scope

| Feature                                   | Reason                                                                                    |
| ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| Achievement Unlocked                      | Deferred na interview — não existe lógica de desbloqueio de conquistas no código hoje     |
| Badge visual de acerto/erro nas previsões | Deferred na interview — melhoria de UI separada, fora do escopo de "configurar analytics" |
| GA4 Measurement Protocol (server-side)    | Descartado na interview a favor da abordagem client-side com `localStorage`               |
| Tracking em `/rankings` e `/achievements` | Não solicitado; fora do mapeamento de rota → evento definido na interview                 |

---

## User Stories

### P1: Configuração base do Firebase Analytics ⭐ MVP

**User Story**: Como sistema, preciso que o Firebase Analytics esteja corretamente inicializado no client, para que qualquer evento instrumentado tenha onde ser enviado.

**Why P1**: Pré-requisito de todas as outras stories — nenhum evento dispara sem isso.

**Acceptance Criteria**:

1. WHEN a aplicação carrega no browser THEN o sistema SHALL inicializar o Firebase Analytics usando `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` (novo, adicionado à config existente em `lib/firebase/client.ts` e ao schema de `lib/env.ts`/`.env.example`)
2. WHEN o ambiente não suporta Analytics (ex: SSR, browsers sem suporte) THEN o sistema SHALL não lançar erro — usa a checagem de suporte já oferecida pelo SDK (`isSupported()`) antes de chamar `getAnalytics()`
3. WHEN qualquer evento é disparado THEN o sistema SHALL passar por um wrapper único (ex: `lib/analytics.ts`) em vez de cada chamador importar `firebase/analytics` diretamente

**Independent Test**: Rodar a aplicação no browser e confirmar (via mock/spy do wrapper) que a inicialização ocorre uma única vez e não lança exceção em ambiente sem suporte.

---

### P1: Evento Login ⭐ MVP

**User Story**: Como sistema, quero registrar quando um usuário efetivamente loga, para medir aquisição/retenção.

**Why P1**: Pedido explícito do usuário; risco real de duplicação se implementado no lugar errado.

**Acceptance Criteria**:

1. WHEN `syncSession` retorna sucesso dentro do fluxo de `use-email-password-mutation.ts` THEN o sistema SHALL disparar o evento `login`
2. WHEN `syncSession` retorna sucesso dentro do fluxo de `use-login-with-google.ts` (após `resolveGoogleRedirect`) THEN o sistema SHALL disparar o evento `login`
3. WHEN `AuthProvider` reage a `onAuthStateChanged` em um reload de página com sessão já válida THEN o sistema SHALL **não** disparar o evento `login` novamente

**Independent Test**: Simular login bem-sucedido (email/senha e Google) e confirmar 1 disparo cada; simular reload de página autenticada e confirmar 0 disparos.

---

### P1: Evento Prediction Created ⭐ MVP

**User Story**: Como sistema, quero registrar quando um usuário cria uma previsão, para medir engajamento com o core loop do produto.

**Why P1**: Pedido explícito do usuário; ponto de disparo já é client-side e direto.

**Acceptance Criteria**:

1. WHEN `submitPrediction` retorna `{ ok: true }` dentro do `onSuccess` de `use-submit-prediction.ts` THEN o sistema SHALL disparar o evento `prediction_created`
2. WHEN `submitPrediction` retorna `{ ok: false }` THEN o sistema SHALL **não** disparar o evento

**Independent Test**: Simular submissão de previsão com sucesso e com falha; confirmar disparo só no caso de sucesso.

---

### P1: Eventos Prediction Won / Prediction Lost ⭐ MVP

**User Story**: Como sistema, quero registrar quando um usuário toma conhecimento de que acertou ou errou uma previsão, para medir a taxa de acerto percebida pelos usuários.

**Why P1**: Pedido explícito do usuário; requer solução alternativa já que o processamento real ocorre em cron server-side sem browser.

**Acceptance Criteria**:

1. WHEN uma previsão com `pointsEarned = 1` aparece na lista de Recent Predictions (dashboard ou profile) e seu `id` ainda não está no set de IDs vistos em `localStorage` THEN o sistema SHALL disparar o evento `prediction_won` e adicionar o `id` ao set
2. WHEN uma previsão com `pointsEarned = 0` aparece na lista e ainda não foi vista THEN o sistema SHALL disparar `prediction_lost` e marcar como vista
3. WHEN uma previsão com `pointsEarned = null` (ainda não processada) aparece na lista THEN o sistema SHALL não disparar nenhum dos dois eventos
4. WHEN uma previsão já marcada como vista aparece novamente em um re-render ou reload THEN o sistema SHALL **não** disparar o evento de novo
5. WHEN o componente de tracking renderiza THEN o sistema SHALL não alterar a aparência visual das seções de Recent Predictions

**Independent Test**: Renderizar a lista com previsões ganhas/perdidas/pendentes não vistas → confirmar disparo correto de cada uma; re-renderizar com as mesmas previsões → confirmar zero disparos adicionais.

---

### P1: Eventos Profile Viewed / Dashboard Viewed / Matches Viewed ⭐ MVP

**User Story**: Como sistema, quero registrar quando um usuário visita cada uma dessas 3 páginas, para medir quais áreas do produto são mais usadas.

**Why P1**: Pedido explícito do usuário; as páginas são Server Components sem client wrapper existente.

**Acceptance Criteria**:

1. WHEN a rota `/home` é visitada THEN o sistema SHALL disparar o evento `dashboard_viewed`
2. WHEN a rota `/profile` é visitada THEN o sistema SHALL disparar o evento `profile_viewed`
3. WHEN a rota `/matches` é visitada THEN o sistema SHALL disparar o evento `matches_viewed`
4. WHEN qualquer outra rota é visitada (ex: `/rankings`, `/achievements`) THEN o sistema SHALL não disparar nenhum evento de page view
5. WHEN o usuário navega entre duas dessas rotas em uma SPA navigation (sem full reload) THEN o sistema SHALL disparar o evento correspondente à nova rota exatamente uma vez

**Independent Test**: Navegar entre `/home`, `/profile`, `/matches`, `/rankings` em sequência e confirmar a sequência exata de eventos disparados (3 disparos, um por rota mapeada, zero para `/rankings`).

---

## Edge Cases

- WHEN o Firebase Analytics falha ao inicializar (ex: bloqueador de anúncios no browser) THEN o sistema SHALL degradar graciosamente — chamadas de `logEvent` não devem lançar exceção não tratada e quebrar a UI
- WHEN `localStorage` não está disponível (ex: modo privado restritivo) THEN o sistema SHALL não quebrar a renderização — a de-duplicação de Won/Lost pode falhar silenciosamente (potencial re-disparo), mas a aplicação continua funcionando
- WHEN uma previsão nunca é processada (permanece `pointsEarned = null` indefinidamente) THEN o sistema SHALL simplesmente nunca disparar Won/Lost para ela — não é um erro

---

## Requirement Traceability

| Requirement ID | Story                                        | Phase  | Status  |
| -------------- | -------------------------------------------- | ------ | ------- |
| ANLY-01        | P1: Configuração base do Firebase Analytics  | In Tasks | Done     |
| ANLY-02        | P1: Evento Login                             | In Tasks | Done     |
| ANLY-03        | P1: Evento Prediction Created                | In Tasks | Done     |
| ANLY-04        | P1: Eventos Prediction Won / Prediction Lost | In Tasks | Done     |
| ANLY-05        | P1: Eventos Profile/Dashboard/Matches Viewed | In Tasks | Done     |

**Coverage:** 5 total, 5 mapped to tasks, 0 unmapped

---

## Success Criteria

- [x] Os 7 eventos (login, prediction_created, prediction_won, prediction_lost, dashboard_viewed, profile_viewed, matches_viewed) disparam corretamente em cenários de teste conhecidos, sem duplicação
- [x] Nenhuma mudança visual perceptível é introduzida em nenhuma tela
- [x] `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` documentado em `.env.example` e validado por `lib/env.ts`
