# GitHub Actions Sync Workflows — Interview Decisions

**Date:** 2026-07-26
**Scope:** Criar 2 workflows do GitHub Actions que chamam as rotas HTTP já existentes (`app/api/sync/*`) do app implantado, usando GitHub Secrets para credenciais. Workflow 1 (diário): sync de competitions/teams/matches. Workflow 2 (10 em 10 min): live/finished + placeholder de prediction processing.
**Source:** Discussão informal (comando `/interview` com argumentos da feature)

---

## Decisões

### Prediction processing (responsabilidade pedida, sem implementação ainda)

- Não existe rota/service de processamento de palpites no código (só a tabela `predictions` no schema). O workflow YAML inclui um step **placeholder comentado com TODO explícito**, apontando para uma rota futura (ex: `POST /api/predictions/process`), mas **não cria nenhuma rota/service novo** nesta rodada.
- **Rationale:** documenta a intenção pedida sem inventar uma API que não foi desenhada nesta sessão de interview.

### Sync de teams no Workflow 1 (dependência implícita)

- Workflow 1 chama, em sequência: `/api/sync/competitions` → `/api/sync/teams` → `/api/sync/matches`.
- **Rationale:** `matches-sync-service` resolve `home_team_id`/`away_team_id` a partir de `teams` já sincronizados — sem isso, `syncMatches` pularia (skip) todas as partidas por time não encontrado. Teams não foi citado explicitamente no pedido, mas é uma dependência técnica real, não uma expansão de escopo.

### URL base do app

- Novo GitHub Secret `APP_BASE_URL` (ex: `https://bet-free.vercel.app`), usado para montar a URL completa de cada chamada.
- **Rationale:** desacopla o workflow de qualquer provedor de hosting específico — funciona independente de onde o app está implantado, sem precisar mudar o YAML depois.

### Tratamento de 409 (lock já em execução)

- `curl -f` simples, sem tratamento especial — um `409` falha o job como qualquer erro HTTP ≥400.
- **Rationale:** decisão explícita do usuário, divergindo da recomendação (que sugeria tratar 409 como sucesso esperado). Mantido conforme pedido — falhar sempre em erro HTTP é mais simples e não esconde nenhum problema de configuração de cron (ex: dois runs realmente sobrepostos por erro de agendamento).

### Sequência dos steps

- Ambos os workflows rodam os steps **sequencialmente, no mesmo job** (não em jobs paralelos/matrix).
- Workflow 1: `competitions` → `teams` → `matches`.
- Workflow 2: `live` → `finished` → (placeholder de predictions).
- **Rationale:** sem ganho real de paralelizar chamadas HTTP rápidas; mais simples de ler no log do Actions.

### Estilo dos steps

- `curl` inline repetido por step, cada um com nome descritivo (`name:` explícito) — sem composite action nem job matrix.
- **Rationale:** matrix rodaria em paralelo por padrão (contradiz a decisão de sequencial) e exigiria `max-parallel: 1`, complexidade desnecessária para 2-3 chamadas.

### Cron

- Workflow 1: `0 3 * * *` (03:00 UTC, diário).
- Workflow 2: `*/10 * * * *` (a cada 10 minutos).
- **Rationale:** GitHub Actions cron é sempre UTC; 03:00 é fora do pico de tráfego comum nas Américas/Europa, sem requisito de negócio específico de horário.

---

## Agent's Discretion

- Nomes exatos dos arquivos de workflow (ex: `.github/workflows/daily-sync.yml`, `.github/workflows/live-sync.yml`).
- Nome exato de cada step (`name:`) — deve ser descritivo, mas o texto exato fica a critério do implementador.
- Uso de `workflow_dispatch` como gatilho adicional (permite rodar manualmente via UI do GitHub) — recomendado por boa prática, mas não foi pedido explicitamente.
- Timeout por job (`timeout-minutes`) — valor razoável para evitar jobs travados indefinidamente.

---

## Deferred Ideas

- Implementação real da rota/service de prediction processing — fica para uma feature futura, quando o domínio de predictions for desenhado.
- Notificações de falha (Slack/email quando um workflow falha) — não foi pedido, fora de escopo.

---

## Open Questions

- Nenhuma pendente.
