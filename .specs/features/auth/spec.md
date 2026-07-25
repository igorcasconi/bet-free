# Firebase Authentication Specification

## Problem Statement

O app não tem nenhum mecanismo de autenticação — qualquer rota é acessível por qualquer visitante, e não há como identificar um usuário. Para qualquer feature de negócio (apostas, rankings, perfil) fazer sentido, o app precisa saber quem está logado e impedir acesso não autenticado às áreas privadas.

## Proposed Solution

Implementar Firebase Authentication (Google + Email/Senha) na feature `features/auth`, com estado de sessão reativo via Context (`AuthProvider`/`useAuth`), mutações de login/signup/logout via React Query, e proteção real de rotas via `middleware.ts` + session cookie (Firebase Admin), redirecionando usuários não autenticados para `/login`. Ao final, um usuário consegue criar conta, logar (Google ou email/senha), navegar pelas rotas protegidas, deslogar, e ao recarregar a página continua logado (persistência de sessão) — sem acesso a nenhuma rota protegida sem sessão válida.

## Goals

- [x] Login com Google e com Email/Senha funcionando end-to-end¹
- [x] Logout limpa sessão no client (Firebase) e no server (cookie)¹
- [x] Sessão persiste entre reloads/fechar-abrir o navegador (dentro da validade do cookie)¹
- [x] Toda rota exceto `/login` exige sessão válida, verificada no server antes de renderizar (sem flash de conteúdo protegido)¹
- [x] `npm run build` e `npm run lint` passam sem erro

¹ Verificado por inspeção estática de código (implementação completa, lógica de decisão coberta por testes unitários) — **não** por smoke test manual com login real. Ambiente não tem projeto Firebase real configurado (`.env.local` contém apenas placeholders), logo o fluxo end-to-end de login/logout/persistência de sessão não pôde ser exercitado ao vivo. Ver seção de verificação em `tasks.md` T21 para detalhes.

## Out of Scope

| Feature                                   | Reason                                              |
| ------------------------------------------ | ---------------------------------------------------- |
| Recuperação de senha (forgot password)     | Não mencionado nos requisitos; feature futura         |
| Login com outros provedores (GitHub, Apple, etc.) | Só Google foi pedido                            |
| Verificação de email obrigatória            | Não mencionado nos requisitos; feature futura         |
| Perfil de usuário / edição de dados         | Fora do escopo de autenticação                        |
| Autorização por papel/permissão (roles)     | Autenticação ≠ autorização; feature futura            |
| Landing page pública de marketing           | Decisão do interview: `/` vira área protegida nesta rodada |
| Testes automatizados                        | Projeto ainda sem infra de testes (mesma decisão do infra-setup) |

---

## User Stories

### P1: Login com Email e Senha ⭐ MVP

**User Story**: Como usuário com conta existente, quero logar com email e senha, para acessar a área protegida do app.

**Why P1**: É o fluxo mais básico de autenticação; sem ele não há MVP de auth.

**Acceptance Criteria**:

1. WHEN o usuário submete o formulário de login com email/senha válidos THEN o sistema SHALL autenticar via `signInWithEmailAndPassword`, criar o session cookie via `POST /api/auth/session`, e redirecionar para `/`
2. WHEN o usuário submete credenciais inválidas THEN o sistema SHALL exibir um toast de erro com mensagem amigável em português (ex: "Email ou senha incorretos") e SHALL não redirecionar
3. WHEN os campos do formulário estão vazios THEN o sistema SHALL bloquear o submit e exibir erro de validação (Zod) inline, sem chamar o Firebase

**Independent Test**: com uma conta de teste já existente no Firebase, logar via formulário, confirmar redirecionamento para `/` e sessão ativa (cookie presente).

---

### P1: Login com Google ⭐ MVP

**User Story**: Como usuário, quero logar com minha conta Google, para não precisar criar/lembrar outra senha.

**Why P1**: Requisito explícito, reduz fricção de onboarding.

**Acceptance Criteria**:

1. WHEN o usuário clica em "Entrar com Google" THEN o sistema SHALL iniciar `signInWithRedirect` com o provider do Google
2. WHEN o usuário retorna do redirect do Google autenticado THEN o sistema SHALL capturar o resultado via `getRedirectResult`, criar o session cookie via `POST /api/auth/session`, e redirecionar para `/`
3. WHEN o usuário cancela o login no provider do Google (nega permissão/fecha) THEN o sistema SHALL retornar ao app sem sessão criada e sem erro fatal (tela em branco/crash)

**Independent Test**: clicar em "Entrar com Google", completar o fluxo com uma conta Google de teste, confirmar sessão ativa após o redirect de volta.

---

### P1: Logout ⭐ MVP

**User Story**: Como usuário logado, quero deslogar, para encerrar minha sessão neste dispositivo.

**Why P1**: Sem logout, sessão persistente vira uma armadilha em dispositivos compartilhados.

**Acceptance Criteria**:

1. WHEN o usuário clica em "Sair" THEN o sistema SHALL chamar `signOut()` do Firebase client SDK E invalidar o session cookie no server
2. WHEN o logout é concluído THEN o sistema SHALL redirecionar o usuário para `/login`
3. WHEN o usuário, após logout, tenta acessar uma rota protegida diretamente pela URL THEN o middleware SHALL redirecioná-lo para `/login`

**Independent Test**: logar, clicar em logout, confirmar redirecionamento para `/login` e que acessar `/` diretamente redireciona de volta para `/login`.

---

### P1: Persistência de sessão e proteção de rotas ⭐ MVP

**User Story**: Como usuário logado, quero continuar autenticado ao recarregar a página ou reabrir o navegador, e quero que rotas privadas sejam inacessíveis sem login.

**Why P1**: É o núcleo funcional que torna toda a feature útil — sem persistência e proteção real, login não protege nada.

**Acceptance Criteria**:

1. WHEN um usuário autenticado recarrega qualquer página THEN o sistema SHALL manter a sessão ativa (sem novo login necessário), respeitando a validade do session cookie
2. WHEN um usuário sem sessão válida (sem cookie ou cookie expirado/inválido) tenta acessar qualquer rota exceto `/login` THEN o `middleware.ts` SHALL redirecioná-lo para `/login` **antes de renderizar a página** (sem flash de conteúdo protegido)
3. WHEN um usuário autenticado acessa `/login` diretamente THEN o sistema SHALL redirecioná-lo para `/` (já logado, não precisa ver o form de novo)
4. WHEN o cookie de sessão é adulterado ou não pode ser verificado pelo Firebase Admin THEN o middleware SHALL tratá-lo como não autenticado e redirecionar para `/login`

**Independent Test**: logar, fechar o navegador, reabrir e navegar para `/` — deve continuar logado. Em aba anônima/sem cookie, acessar `/` — deve redirecionar para `/login`.

---

### P2: Sign Up (criação de conta por email)

**User Story**: Como novo usuário, quero criar uma conta com email e senha, para começar a usar o app sem precisar de conta Google.

**Why P2**: Importante para onboarding, mas o app funciona (demonstrável) com contas pré-existentes/Google mesmo sem essa story.

**Acceptance Criteria**:

1. WHEN o usuário submete o formulário de sign up com email/senha válidos (e não usados) THEN o sistema SHALL criar a conta via `createUserWithEmailAndPassword`, criar o session cookie, e redirecionar para `/`
2. WHEN o email já está em uso THEN o sistema SHALL exibir toast de erro amigável (ex: "Este email já está cadastrado") sem criar conta duplicada
3. WHEN a senha não atende ao mínimo de caracteres exigido pelo Firebase THEN o sistema SHALL bloquear o submit com erro de validação inline antes de chamar o Firebase

**Independent Test**: criar conta nova com email não usado, confirmar login automático e sessão ativa; tentar de novo com o mesmo email, confirmar erro sem crash.

---

### P2: Feedback de erro consistente (toasts)

**User Story**: Como usuário, quero mensagens de erro claras quando login/signup/logout falham, para entender o que fazer a seguir.

**Why P2**: Melhora UX mas as stories P1 já funcionam sem isso (com erro menos amigável).

**Acceptance Criteria**:

1. WHEN qualquer operação de auth (login, signup, logout) falha THEN o sistema SHALL exibir um `toast.error(...)` via `sonner` com mensagem mapeada em português para os erros mais comuns do Firebase (`auth/wrong-password`, `auth/user-not-found`, `auth/invalid-credential`, `auth/email-already-in-use`, `auth/too-many-requests`)
2. WHEN o código de erro do Firebase não está mapeado THEN o sistema SHALL exibir uma mensagem genérica ("Algo deu errado, tente novamente") em vez do código técnico cru

**Independent Test**: forçar um erro conhecido (senha errada) e um erro não mapeado (simular), confirmar que ambos exibem toast amigável.

---

## Edge Cases

- WHEN o `idToken` enviado para `POST /api/auth/session` é inválido ou expirado THEN o Route Handler SHALL retornar erro (4xx) sem setar cookie
- WHEN `firebase-admin` não consegue inicializar (env vars server ausentes/incorretas) THEN o build/dev SHALL falhar de forma clara (mesma convenção de `lib/env.ts` do infra-setup), não silenciosamente
- WHEN o usuário fecha o popup/aba durante `signInWithRedirect` antes do retorno THEN nenhuma sessão parcial SHALL ser criada
- WHEN múltiplas abas estão abertas e o usuário desloga em uma delas THEN as outras abas, ao navegar ou revalidar, SHALL respeitar o cookie invalidado (nova navegação redireciona para `/login`) — sincronização em tempo real entre abas está fora de escopo
- WHEN o middleware não encontra cookie de sessão em uma rota protegida THEN SHALL redirecionar preservando a URL de destino (ex: `?redirect=/rota-original`) para retornar após login — resolvido em design.md via `?redirect=` lido pelo middleware e pela página de login

---

## Requirement Traceability

| Requirement ID | Story                                       | Phase     | Status    |
| --------------- | -------------------------------------------- | --------- | --------- |
| AUTH-01         | P1: Login com Email e Senha                   | Done      | Done |
| AUTH-02         | P1: Login com Google                          | Done      | Done |
| AUTH-03         | P1: Logout                                    | Done      | Done |
| AUTH-04         | P1: Persistência de sessão e proteção de rotas | Done      | Done |
| AUTH-05         | P2: Sign Up                                   | Done      | Done |
| AUTH-06         | P2: Feedback de erro consistente               | Done      | Done |

**Coverage:** 6 total, 6 mapped to tasks, 0 unmapped

---

## Success Criteria

- [x] Usuário consegue criar conta, logar (Google e email/senha), navegar autenticado, deslogar¹
- [x] Nenhuma rota exceto `/login` é acessível sem sessão válida (verificado server-side)¹
- [x] Sessão sobrevive a reload de página¹
- [x] `npm run build` e `npm run lint` passam sem erro
- [x] `features/auth` expõe API pública via `index.ts`, sem imports internos cruzados de outras features

¹ Ver nota de limitação em Goals acima: verificado por leitura de código, não por execução real contra Firebase.
