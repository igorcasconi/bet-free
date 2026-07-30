# Firebase Analytics — Interview Decisions

**Date:** 2026-07-30
**Scope:** Configurar Firebase Analytics e instrumentar eventos de produto — Login, Prediction Created, Prediction Won, Prediction Lost, Profile Viewed, Dashboard Viewed, Matches Viewed — sem duplicar disparos.
**Source:** Interview interativa (sem spec prévio; feature nova, sem referência anterior em `.specs/`)

---

## Decisions

### Configuração base do Firebase Analytics

- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` precisa ser adicionado à config do client (`lib/firebase/client.ts`) e ao schema de `lib/env.ts`/`.env.example` — hoje ausente, Analytics não inicializa sem isso.
- Firebase Analytics client SDK só funciona em contexto de browser — toda instrumentação vive em client components.

### Login

- Evento dispara no callback de sucesso de `use-email-password-mutation.ts` e `use-login-with-google.ts` (logo após `syncSession` bem-sucedido, antes/junto do `router.push`).
- **Nunca** no `onAuthStateChanged` de `AuthProvider` — esse listener dispara a cada mount/reload de página com sessão já existente, o que duplicaria o evento a cada carregamento.
- **Rationale:** único ponto que representa exatamente-uma-vez um login real, distinto de "sessão já válida sendo revalidada".

### Prediction Created

- Evento dispara dentro do `onSuccess` de `features/matches/hooks/use-submit-prediction.ts`, guardado por `if (!result.ok) return;` (mesmo guard já usado ali).
- Sem gray area adicional — fluxo já é client-side e dispara exatamente uma vez por submissão bem-sucedida.

### Prediction Won / Prediction Lost

- `points_earned` é setado por um cron job server-side (`features/prediction-processing`), sem contexto de browser — o SDK client do Firebase Analytics não roda lá. Confirmado: sem Measurement Protocol configurado, sem alternativa server-side hoje.
- **Decisão:** evento dispara no client, na primeira vez que o usuário **vê** uma previsão já resolvida (não no momento em que o cron processa). Muda a semântica de "quando foi decidido" para "quando o usuário soube", mas evita construir infraestrutura nova.
- **De-duplicação:** via `localStorage` no client (ex: chave `analytics_seen_predictions`, um Set de IDs de previsão já trackadas). Antes de disparar Won/Lost para uma previsão, verifica se o ID já está no set; se não, dispara e marca como visto. Sem coluna nova no banco, sem endpoint novo.
  - **Rationale:** simplicidade — sem migration, sem escrita no backend só para analytics. Aceita-se que limpar o storage ou trocar de dispositivo pode re-disparar o evento; não é dado crítico.
- **Instrumentação:** o tipo `DashboardPrediction` (e `ProfileData.latestPredictions`, que reaproveita o mesmo tipo) precisa ganhar o campo `pointsEarned: 0 | 1 | null`. Um novo componente client (ex: `PredictionResultsTracker`) recebe as previsões (via props vindas do Server Component) e, no mount/quando a lista mudar, dispara Won/Lost para as previsões resolvidas ainda não vistas.
- **Sem mudança visual:** a instrumentação é invisível — nenhum badge de "✓ Acertou"/"✗ Errou" é adicionado à UI nesta rodada. Isso é uma melhoria de produto separada, fora de escopo.

### Achievement Unlocked

- **Removido do escopo desta rodada.** Não existe nenhuma lógica de desbloqueio de conquista no código (`user_achievements` é só lido por `features/profile`, nunca escrito por nada). Instrumentar esse evento significaria instrumentar algo que não existe funcionalmente.
- Deferred: quando a feature de desbloqueio de achievements for construída, esse evento deve ser adicionado ali (ponto de disparo natural: onde quer que o unlock seja gravado em `user_achievements`).

### Profile Viewed / Dashboard Viewed / Matches Viewed

- Um único componente client genérico (ex: `PageViewTracker`) dentro de `features/navigation/components/app-shell.tsx` (que já envolve todas as páginas via `app/(app)/layout.tsx`).
- Usa `usePathname()` + mapeamento `pathname → nome do evento` (`/home` → Dashboard Viewed, `/profile` → Profile Viewed, `/matches` → Matches Viewed). Um único lugar cobre as 3 rotas, sem duplicar `useEffect` em cada página.
- Dispara uma vez por navegação real (efeito reagindo à mudança de `pathname`) — esse é o comportamento padrão de "page view" em analytics, não uma duplicação.
- Rotas fora do mapeamento (`/rankings`, `/achievements`) simplesmente não disparam nada — não fazem parte do escopo pedido.

---

## Agent's Discretion

- Nenhuma área foi delegada como "você decide" nesta interview — todas as decisões de negócio foram fechadas explicitamente pelo usuário.
- Detalhes puramente de implementação (nome exato do wrapper de analytics, estrutura interna de `lib/analytics.ts`, formato exato da chave de `localStorage`, nomes de arquivo dentro de `features/`) ficam a critério do implementador.

---

## Deferred Ideas

- Badge visual de acerto/erro nos cards de Recent Predictions — surgiu na discussão de Prediction Won/Lost, mas é melhoria de UI separada.
- Achievement Unlocked como evento — depende de uma feature futura de desbloqueio de conquistas (seed + lógica de critério).
- Medição server-side via GA4 Measurement Protocol — alternativa descartada para Won/Lost em favor da abordagem client-side com `localStorage`; poderia ser reconsiderada se a semântica exata "no momento do processamento" se tornar importante no futuro.
- Coluna `predictions.result_seen_at` (alternativa de de-dup mais robusta a troca de dispositivo) — descartada em favor de `localStorage` por simplicidade.

---

## Open Questions

- Nenhuma pendência bloqueante identificada.
