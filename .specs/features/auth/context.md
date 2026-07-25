# Firebase Authentication — Interview Decisions

**Date:** 2026-07-25
**Scope:** Implementar Firebase Authentication completo (Google Login, Email/Senha Login + Sign Up, Logout, persistência de sessão) na feature `features/auth` (components, actions, hooks, services, types), com proteção server-side de rotas autenticadas via middleware, redirecionando usuários não-logados para `/login`, seguindo Feature Driven Design e usando React Query para mutações.
**Source:** Discussão informal (comando `/interview` com argumentos de feature)

---

## Decisões

### Proteção de rotas

- Middleware (`middleware.ts`) + session cookie via Firebase Admin SDK, não guard client-side puro.
- Allowlist de rotas públicas: apenas `/login` (grupo `app/(auth)/login`). Todas as demais rotas, incluindo `/` (home atual), exigem sessão válida.
- Usuário não autenticado tentando acessar rota protegida é redirecionado para `/login` **antes da renderização** (server-side, sem flash de conteúdo).
- **Rationale:** proteção real (não apenas cosmética), consistente com server-first do CLAUDE.md; allowlist é mais fácil de manter conforme novas rotas nascerem (tudo protegido por padrão).

### Sincronização de sessão (client → server)

- Route Handler `app/api/auth/session/route.ts` recebe `idToken` via POST, usa `firebase-admin` (`createSessionCookie`) e seta o cookie de sessão via `Set-Cookie`.
- Chamado pelos hooks de login logo após `signInWithPopup`/`signInWithRedirect`/`signInWithEmailAndPassword`/`createUserWithEmailAndPassword` retornarem sucesso.
- Logout: Route Handler equivalente (ou o mesmo endpoint com `DELETE`) limpa o cookie; hook de logout chama esse endpoint E `firebase/auth` `signOut()` no client.
- Requer novas env vars **server-only** em `lib/env.ts`: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (service account, nunca expostas ao client) + pacote `firebase-admin`.
- **Rationale:** padrão oficial recomendado pelo Firebase para Next.js App Router; Server Actions não têm o mesmo controle direto de `Set-Cookie` em resposta a uma chamada iniciada do client da forma que Route Handlers têm.

### Estado de sessão no client

- `AuthProvider` (Context API — permitido pelo CLAUDE.md especificamente para Auth Session) escuta `onAuthStateChanged` do Firebase client SDK e expõe `{ user, loading }` via hook `useAuth()`.
- React Query (`useMutation`) usado para as ações de login/signup/logout — não para o estado de sessão em si (que é reativo via Context, não uma query assíncrona pontual).
- Após mutação de login/signup bem-sucedida, o Context reflete a mudança automaticamente via `onAuthStateChanged` (sem necessidade de invalidação manual de cache).
- **Rationale:** segue literalmente a regra do CLAUDE.md ("Context API só para Theme, Auth Session, User Preferences") e usa React Query apenas onde há real client-side mutation/server communication.

### Login com Google

- `signInWithRedirect` + `getRedirectResult` (não popup).
- **Rationale:** mais confiável em mobile/webviews, não depende de popup blockers.

### Email/Senha

- Login (`signInWithEmailAndPassword`) **e** Sign Up (`createUserWithEmailAndPassword`) estão no escopo.
- **Rationale:** sem sign up, não há via de onboarding por email — só Google funcionaria para criar conta.

### Tratamento de erros

- Toast/notificação global via `sonner` (novo pacote, ainda não instalado no setup anterior).
- Instalação via `npx shadcn@latest add sonner`, `<Toaster />` adicionado ao root layout, `toast.error(...)` chamado nos hooks de auth em caso de erro (login, signup, logout).
- Mensagens de erro do Firebase (ex: `auth/wrong-password`, `auth/email-already-in-use`) mapeadas para mensagens amigáveis em português.
- **Rationale:** decisão explícita do usuário; shadcn/ui recomenda `sonner` como padrão, mantendo consistência com o resto do stack de UI.

### Estrutura de rotas

- `app/(auth)/login/page.tsx` — página pública de login (route group, não afeta a URL).
- `/` (app/page.tsx atual) passa a ser protegida (área logada/placeholder de dashboard) — não há landing page de marketing nesta rodada.
- **Rationale:** decisão explícita do usuário; simplifica o allowlist do middleware (só `/login` é pública).

### Estrutura da feature (`features/auth/`)

- `components/` — formulários e botões de auth (ex: `LoginForm`, `SignUpForm`, `GoogleLoginButton`, `LogoutButton`)
- `hooks/` — `useLogin`, `useSignUp`, `useLoginWithGoogle`, `useLogout` (React Query `useMutation`), `useAuth` (consome o Context)
- `actions/` — lógica de sincronização de sessão que precisa rodar no server (chamadas ao Route Handler a partir dos hooks, ou Server Actions auxiliares se necessário)
- `services/` — wrappers finos sobre o Firebase client SDK (`signInWithEmailAndPassword`, `createUserWithEmailAndPassword`, `signInWithRedirect`, `signOut`, mapeamento de erros)
- `types/` — tipos de usuário autenticado, DTOs de erro, etc.
- `index.ts` — API pública da feature (`AuthProvider`, `useAuth`, componentes exportados)
- **Rationale:** segue Feature Driven Design do CLAUDE.md, com `index.ts` como única porta de entrada para outras partes do app.

---

## Agent's Discretion

- Nomenclatura exata dos hooks/services internos (desde que a API pública via `index.ts` exponha `AuthProvider`, `useAuth`, e os componentes de formulário/botão).
- Mapeamento específico de códigos de erro do Firebase para mensagens em português — usar bom senso para os casos mais comuns (`auth/wrong-password`, `auth/user-not-found`, `auth/email-already-in-use`, `auth/invalid-credential`, `auth/too-many-requests`).
- Duração/expiração exata do session cookie (usar padrão razoável, ex: 5 dias, renovável no login).
- Layout visual exato da página de login/signup (usar componentes shadcn já instalados — `button.tsx` — e adicionar os que forem necessários, ex: `input`, `form`, `card`).

---

## Deferred Ideas

- Nenhuma — todas as ideias levantadas na entrevista couberam no escopo (sign up foi incluído no escopo principal, não como ideia adiada).

---

## Open Questions

- Nenhuma pendente.
