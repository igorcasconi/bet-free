# GitHub Actions Sync Workflows Specification

**Context**: `.specs/features/github-actions-sync/context.md`

## Problem Statement

As rotas `app/api/sync/*` existem e funcionam, mas nada as aciona
automaticamente — hoje só podem ser chamadas manualmente via `curl`. Sem um
gatilho agendado, o banco nunca é populado/atualizado sozinho.

## Proposed Solution

Dois workflows do GitHub Actions em `.github/workflows/`, cada um rodando
`curl` sequencial contra as rotas já existentes, autenticados via
`x-sync-secret` e usando um novo secret `APP_BASE_URL` para montar a URL —
todos os valores vindos de GitHub Secrets, nunca hardcoded no YAML.

## Goals

- [x] Workflow diário popula/atualiza competitions, teams e matches sem
      intervenção manual
- [x] Workflow a cada 10 min mantém live/finished matches atualizados
- [x] Nenhum segredo (URL, secret de sync) aparece hardcoded no YAML —
      100% via `${{ secrets.* }}`

## Out of Scope

| Feature                                        | Reason                                                                     |
| ---------------------------------------------- | -------------------------------------------------------------------------- |
| Rota/service real de prediction processing     | Não existe ainda no código — só um placeholder comentado, ver `context.md` |
| Notificações de falha (Slack/email)            | Não pedido, fora de escopo                                                 |
| Tratamento especial de `409` (lock já rodando) | Decisão explícita: `curl -f` falha o job normalmente, ver `context.md`     |

---

## User Stories

### P1: Daily Catalog Sync Workflow ⭐ MVP

**User Story**: Como operador, quero um workflow agendado 1x/dia que
sincroniza competitions, teams e matches em sequência, para que o catálogo
de dados esteja sempre atualizado sem ação manual.

**Why P1**: É metade do pedido original — sem isso, `/api/sync/competitions`,
`/teams`, `/matches` nunca são acionadas automaticamente.

**Acceptance Criteria**:

1. WHEN o workflow dispara (cron `0 3 * * *`, 03:00 UTC) THEN ele SHALL
   chamar, em sequência, `POST {APP_BASE_URL}/api/sync/competitions` →
   `POST {APP_BASE_URL}/api/sync/teams` → `POST {APP_BASE_URL}/api/sync/matches`.
2. WHEN qualquer chamada usa o header `x-sync-secret` THEN o valor SHALL vir
   de `${{ secrets.SYNC_SECRET }}`, nunca hardcoded.
3. WHEN `APP_BASE_URL` é usado para montar a URL THEN o valor SHALL vir de
   `${{ secrets.APP_BASE_URL }}`.
4. WHEN uma chamada retorna status HTTP ≥400 (incluindo `409`) THEN o step
   SHALL falhar (via `curl -f`), interrompendo os steps seguintes.
5. WHEN o workflow é aberto no GitHub THEN ele SHALL também ser acionável
   manualmente via `workflow_dispatch` (Agent's Discretion — boa prática).

**Independent Test**: Rodar o workflow manualmente (`workflow_dispatch`)
contra um ambiente de teste; confirmar as 3 chamadas na ordem certa nos
logs do Actions; simular uma resposta de erro na 2ª chamada e confirmar que
a 3ª nunca roda.

---

### P1: Live/Finished Sync Workflow

**User Story**: Como operador, quero um workflow agendado a cada 10 minutos
que atualiza partidas ao vivo e reconcilia partidas finalizadas, para que os
dados de placar fiquem atualizados com baixa latência.

**Why P1**: É a outra metade do pedido original — cobre o caso de uso de
"tempo real" do app.

**Acceptance Criteria**:

1. WHEN o workflow dispara (cron `*/10 * * * *`) THEN ele SHALL chamar, em
   sequência, `POST {APP_BASE_URL}/api/sync/live` →
   `POST {APP_BASE_URL}/api/sync/finished`.
2. WHEN o workflow inclui o step de "trigger prediction processing" THEN
   ele SHALL existir apenas como step comentado com `TODO` explícito,
   referenciando uma rota futura (`/api/predictions/process`) — SHALL NOT
   chamar nenhum endpoint real.
3. WHEN autenticação/URL são usadas THEN as mesmas regras dos Acceptance
   Criteria 2-3 da story anterior SHALL se aplicar (secrets, nunca
   hardcoded).
4. WHEN uma chamada retorna status ≥400 THEN o mesmo comportamento de falha
   (`curl -f`) da story anterior SHALL se aplicar.

**Independent Test**: Rodar manualmente via `workflow_dispatch`; confirmar
2 chamadas HTTP reais nos logs + 1 step de placeholder visível mas não
executando nenhuma chamada de rede.

---

## Edge Cases

- WHEN `APP_BASE_URL` ou `SYNC_SECRET` não estão configurados como secrets
  do repositório THEN o workflow SHALL falhar de forma óbvia (variável
  vazia gera URL/header inválido, `curl` retorna erro, step falha) — sem
  mascarar o problema.
- WHEN dois disparos do mesmo workflow se sobrepõem (ex: run anterior
  ainda rodando) THEN o comportamento SHALL ser o do lock já existente no
  backend (`409` → falha do step) — o workflow em si não implementa
  nenhuma prevenção adicional de concorrência.

---

## Requirement Traceability

| Requirement ID | Story                           | Phase        | Status |
| -------------- | ------------------------------- | ------------ | ------ |
| GHA-01         | P1: Daily Catalog Sync Workflow | Implementing | Done   |
| GHA-02         | P1: Live/Finished Sync Workflow | Implementing | Done   |

**Coverage:** 2 total, 2 mapped to tasks, 0 unmapped

**Verification note:** sem acesso a um ambiente GitHub Actions real neste
ambiente para disparar os workflows de fato — verificação feita via
parsing YAML local (`js-yaml`), confirmando estrutura (`on.schedule`,
`on.workflow_dispatch`, ordem dos `steps`, step de predictions comentado
não aparecendo na lista de steps ativos). Recomenda-se rodar
`workflow_dispatch` manualmente após o merge, com `APP_BASE_URL` e
`SYNC_SECRET` configurados nos Secrets do repositório, para validar
ponta a ponta.

---

## Success Criteria

- [x] `.github/workflows/daily-sync.yml` roda 3 chamadas em ordem, cron
      `0 3 * * *`
- [x] `.github/workflows/live-sync.yml` roda 2 chamadas em ordem + 1 step
      placeholder comentado, cron `*/10 * * * *`
- [x] Zero valor sensível hardcoded — tudo via `${{ secrets.* }}`
- [x] Ambos os workflows aceitam `workflow_dispatch` manual
