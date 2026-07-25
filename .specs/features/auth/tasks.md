# Firebase Authentication Tasks

**Design**: `.specs/features/auth/design.md`
**Status**: Done (phases 1–6 complete; T21 functional smoke test limited to static verification — no real Firebase project available in this environment)

---

## Execution Plan

### Phase 1: Foundation (Sequential) — **Est. tokens**: ~35k

```
T1 → T2 → T3 → T4 → T5
```

### Phase 2: Server & Client Primitives (Parallel OK) — **Est. tokens**: ~70k

```
        ┌→ T6 (auth-service + mapFirebaseError test)
        ├→ T7 (session-actions)
T5 ─────┼→ T8 (api/auth/session route)
        └→ T9 (middleware + decision-logic test)
```

### Phase 3: Auth State & Hooks (Parallel OK, depends on Phase 2) — **Est. tokens**: ~55k

```
              ┌→ T10 (auth-provider + use-auth)
T6, T7, T8 ───┼→ T11 (use-login + use-sign-up)
              ├→ T12 (use-login-with-google)
              └→ T13 (use-logout)
```

### Phase 4: Components (Parallel OK, depends on Phase 3) — **Est. tokens**: ~50k

```
                ┌→ T14 (LoginForm)
T10, T11,       ├→ T15 (SignUpForm)
T12, T13 ───────┼→ T16 (GoogleLoginButton)
                └→ T17 (LogoutButton)
```

### Phase 5: Wiring & Pages (Sequential, depends on Phase 4) — **Est. tokens**: ~40k

```
T18 → T19 → T20
```

### Phase 6: Final Verification (Sequential) — **Est. tokens**: ~20k

```
T21
```

---

## Task Breakdown

### T1: Install dependencies

**What**: `npm install firebase-admin`; `npm install -D vitest`; `npx shadcn@latest add form input label sonner`.
**Where**: `package.json`, `package-lock.json`, `components/ui/form.tsx`, `components/ui/input.tsx`, `components/ui/label.tsx`, `components/ui/sonner.tsx`
**Depends on**: None
**Requirement**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-06

**Tools**:
- MCP: NONE
- Skill: `search` (confirm current `firebase-admin` and `vitest` install/config for Next.js 16)

**Done when**:
- [x] `firebase-admin` in `dependencies`
- [x] `vitest` in `devDependencies`
- [x] shadcn `form`, `input`, `label`, `sonner` components present in `components/ui/`
- [x] Gate check passes: `npm install` exits 0

**Tests**: none
**Gate**: build

---

### T2: Extend `lib/env.ts` with Firebase Admin server vars

**What**: Add a `server` block to the existing `createEnv` call: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (all `z.string().min(1)`), wired into `experimental__runtimeEnv`.
**Where**: `lib/env.ts`
**Depends on**: T1
**Reuses**: existing `lib/env.ts` client block pattern
**Requirement**: AUTH-04

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `env.FIREBASE_PROJECT_ID`, `env.FIREBASE_CLIENT_EMAIL`, `env.FIREBASE_PRIVATE_KEY` typed and validated, server-only (not prefixed `NEXT_PUBLIC_`)
- [x] `.env.example` updated with the 3 new vars (placeholder values, `FIREBASE_PRIVATE_KEY` placeholder shows the `\n`-escaped PEM format)
- [x] Gate check passes: `npm run build` (with `.env.local` populated)

**Tests**: none
**Gate**: build

---

### T3: Create `lib/firebase/admin.ts`

**What**: Initialize `firebase-admin` once (guarded against re-init), export `adminAuth`.
**Where**: `lib/firebase/admin.ts`
**Depends on**: T2
**Reuses**: `lib/env.ts`, same singleton-guard pattern as `lib/firebase/client.ts`
**Requirement**: AUTH-04

**Tools**:
- MCP: NONE
- Skill: `search` (confirm current `firebase-admin` `cert`/`initializeApp`/`getApps` API)

**Done when**:
- [x] Exports `adminAuth` (`Auth` instance from `firebase-admin/auth`)
- [x] Guarded with `getApps().length ? getApp() : initializeApp(...)`
- [x] `FIREBASE_PRIVATE_KEY` newline-escaping handled (`.replace(/\\n/g, "\n")`)
- [x] Gate check passes: `npm run build`

**Tests**: none
**Gate**: build

---

### T4: Create `features/auth/types/index.ts`

**What**: Define `AuthUser` and `EmailPasswordCredentials` interfaces per design.md.
**Where**: `features/auth/types/index.ts`
**Depends on**: T1
**Requirement**: AUTH-01, AUTH-02, AUTH-05

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `AuthUser { uid, email, displayName, photoURL }` exported
- [x] `EmailPasswordCredentials { email, password }` exported
- [x] Gate check passes: `npm run build`

**Tests**: none
**Gate**: build

---

### T5: Configure Vitest

**What**: Add `vitest.config.ts` (node environment, no jsdom needed for the pure-logic tests planned), add `"test": "vitest run"` script to `package.json`.
**Where**: `vitest.config.ts`, `package.json`
**Depends on**: T1
**Requirement**: N/A (test infra, supports AUTH-01..06 verification)

**Tools**:
- MCP: NONE
- Skill: `search` (confirm current Vitest config for a Next.js + TS project, path alias resolution for `@/*`)

**Done when**:
- [x] `npm run test` executes (0 tests found is acceptable at this point — proves the runner works)
- [x] `@/*` path alias resolves inside test files
- [x] Gate check passes: `npm run test`

**Tests**: none (infra setup)
**Gate**: build

---

### T6: `features/auth/services/auth-service.ts` [P]

**What**: Implement `signInWithEmail`, `signUpWithEmail`, `signInWithGoogleRedirect`, `resolveGoogleRedirect`, `signOutClient`, `mapFirebaseError` per design.md. Write unit tests for `mapFirebaseError` (pure function, easy to isolate).
**Where**: `features/auth/services/auth-service.ts`, `features/auth/services/auth-service.test.ts`
**Depends on**: T5 (vitest), T4 (types)
**Reuses**: `lib/firebase/client.ts` (`auth`)
**Requirement**: AUTH-01, AUTH-02, AUTH-05, AUTH-06

**Tools**:
- MCP: NONE
- Skill: `search` (confirm current `firebase/auth` modular API: `signInWithEmailAndPassword`, `signInWithRedirect`, `getRedirectResult`, `GoogleAuthProvider`)

**Done when**:
- [x] All 6 functions implemented and exported
- [x] `mapFirebaseError` covers: `auth/invalid-credential`, `auth/user-not-found`, `auth/wrong-password`, `auth/email-already-in-use`, `auth/too-many-requests`, and a fallback for unmapped codes
- [x] Unit tests: at least 6 cases (one per mapped code + fallback), all pass
- [x] Gate check passes: `npm run test -- auth-service` and `npm run build`

**Tests**: unit
**Gate**: quick

---

### T7: `features/auth/actions/session-actions.ts` [P]

**What**: Implement `syncSession(idToken)` (`POST /api/auth/session`) and `clearSession()` (`DELETE /api/auth/session`), both throwing on non-2xx.
**Where**: `features/auth/actions/session-actions.ts`
**Depends on**: T5
**Requirement**: AUTH-01, AUTH-02, AUTH-03, AUTH-05

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `syncSession` and `clearSession` implemented, throw descriptive errors on failure
- [x] Gate check passes: `npm run build`

**Tests**: none (thin fetch wrapper, exercised end-to-end in later phases)
**Gate**: build

---

### T8: `app/api/auth/session/route.ts` [P]

**What**: Route Handler with `POST` (create session cookie via `adminAuth.createSessionCookie`, `Set-Cookie` `__session`, `httpOnly`, `secure` in prod, `sameSite: lax`, `maxAge` 5 days) and `DELETE` (clear cookie).
**Where**: `app/api/auth/session/route.ts`
**Depends on**: T3
**Reuses**: `lib/firebase/admin.ts`
**Requirement**: AUTH-01, AUTH-02, AUTH-03, AUTH-04

**Tools**:
- MCP: NONE
- Skill: `search` (confirm current Next.js 16 Route Handler cookie-setting API: `NextResponse` + `cookies()`)

**Done when**:
- [x] `POST` with valid `idToken` returns `204` and sets `Set-Cookie`
- [x] `POST` with invalid/expired `idToken` returns `401`, no cookie set
- [x] `DELETE` returns `204` and clears the cookie (`maxAge: 0`)
- [x] Gate check passes: `npm run build`

**Tests**: none (requires a real/valid Firebase ID token to test meaningfully — covered by manual verification in T21)
**Gate**: build

---

### T9: `middleware.ts` + route-decision logic [P]

**What**: Root `middleware.ts`, Node.js runtime (`export const config = { runtime: "nodejs", matcher: [...] }`), verifying `__session` via `adminAuth.verifySessionCookie`. Extract the pure decision logic (`isPublicPath(pathname)`, and the redirect-vs-next decision given `{ pathname, hasValidSession }`) into a separate, unit-testable function.
**Where**: `middleware.ts`, `lib/auth/middleware-logic.ts`, `lib/auth/middleware-logic.test.ts`
**Depends on**: T3, T5
**Reuses**: `lib/firebase/admin.ts`
**Requirement**: AUTH-04

**Tools**:
- MCP: NONE
- Skill: `search` (confirm Next.js 16 middleware `matcher` config syntax + Node.js runtime opt-in flag exact shape)

**Done when**:
- [x] `matcher` excludes `/_next/*`, static file extensions, `/api/auth/session`
- [x] Unauthenticated request to a protected path → redirect to `/login?redirect=<pathname>`
- [x] Authenticated request to `/login` → redirect to `/`
- [x] Invalid/tampered cookie → treated as unauthenticated (no throw escaping to a 500)
- [x] Unit tests for `isPublicPath`/decision function: covers protected+valid, protected+invalid, `/login`+valid, `/login`+invalid — all pass
- [x] Gate check passes: `npm run test -- middleware-logic` and `npm run build`

**Tests**: unit
**Gate**: quick

---

### T10: `AuthProvider` + `useAuth` [P]

**What**: `features/auth/components/auth-provider.tsx` (Context, `onAuthStateChanged` listener, `toAuthUser` mapper) and `features/auth/hooks/use-auth.ts` (context consumer, throws if used outside provider).
**Where**: `features/auth/components/auth-provider.tsx`, `features/auth/hooks/use-auth.ts`
**Depends on**: T6, T4
**Reuses**: `lib/firebase/client.ts` (`auth`), `features/auth/types`
**Requirement**: AUTH-04

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `AuthProvider` exposes `{ user: AuthUser | null, loading: boolean }` via context
- [x] `useAuth()` throws a clear error if called outside `AuthProvider`
- [x] Gate check passes: `npm run build`

**Tests**: none (thin wrapper over `onAuthStateChanged`, integration-verified in T21)
**Gate**: build

---

### T11: `useLogin` + `useSignUp` [P]

**What**: Two `useMutation` hooks calling `auth-service` + `session-actions`, redirecting on success (`router.push(redirectTo ?? "/")`) and `toast.error(mapFirebaseError(err))` on failure.
**Where**: `features/auth/hooks/use-login.ts`, `features/auth/hooks/use-sign-up.ts`
**Depends on**: T6, T7
**Reuses**: `@tanstack/react-query`, `next/navigation`, `sonner`
**Requirement**: AUTH-01, AUTH-05, AUTH-06

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `useLogin({ email, password })` mutation: on success calls `syncSession` then redirects; on error shows toast
- [x] `useSignUp({ email, password })` mirrors `useLogin` using `signUpWithEmail`
- [x] Gate check passes: `npm run build`

**Tests**: none (exercised via component + manual flow in T21)
**Gate**: build

---

### T12: `useLoginWithGoogle` [P]

**What**: Hook triggering `signInWithGoogleRedirect`, plus a `resolveRedirect()` effect-friendly function called once on the login page to consume `getRedirectResult`, sync session, and redirect.
**Where**: `features/auth/hooks/use-login-with-google.ts`
**Depends on**: T6, T7
**Requirement**: AUTH-02, AUTH-06

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `useLoginWithGoogle()` exposes a function to start the redirect and a function/effect to resolve it
- [x] `resolveGoogleRedirect()` returning `null` (user cancelled) is a no-op, not an error
- [x] Gate check passes: `npm run build`

**Tests**: none
**Gate**: build

---

### T13: `useLogout` [P]

**What**: Mutation calling `signOutClient()` + `clearSession()`, redirecting to `/login` on success, toast on failure.
**Where**: `features/auth/hooks/use-logout.ts`
**Depends on**: T6, T7
**Requirement**: AUTH-03, AUTH-06

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `useLogout()` calls both client sign-out and server session clear
- [x] Redirects to `/login` on success
- [x] Gate check passes: `npm run build`

**Tests**: none
**Gate**: build

---

### T14: `LoginForm` [P]

**What**: Email/senha form (RHF + Zod resolver), calling `useLogin`.
**Where**: `features/auth/components/login-form.tsx`
**Depends on**: T11
**Reuses**: shadcn `form`, `input`, `label`, `button`
**Requirement**: AUTH-01

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Zod schema blocks empty/invalid email or password before calling Firebase
- [x] Submit calls `useLogin().mutate`
- [x] Gate check passes: `npm run build`

**Tests**: none
**Gate**: build

---

### T15: `SignUpForm` [P]

**What**: Email/senha account creation form, calling `useSignUp`.
**Where**: `features/auth/components/sign-up-form.tsx`
**Depends on**: T11
**Reuses**: shadcn `form`, `input`, `label`, `button`; mirrors `LoginForm` structure
**Requirement**: AUTH-05

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Zod schema enforces Firebase's minimum password length before calling Firebase
- [x] Submit calls `useSignUp().mutate`
- [x] Gate check passes: `npm run build`

**Tests**: none
**Gate**: build

---

### T16: `GoogleLoginButton` [P]

**What**: Button triggering `useLoginWithGoogle().signIn()`; page-level `resolveGoogleRedirect()` call lives in the login page (T19), not in this component.
**Where**: `features/auth/components/google-login-button.tsx`
**Depends on**: T12
**Reuses**: shadcn `button`
**Requirement**: AUTH-02

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Click triggers `signInWithGoogleRedirect`
- [x] Gate check passes: `npm run build`

**Tests**: none
**Gate**: build

---

### T17: `LogoutButton` [P]

**What**: Button triggering `useLogout().mutate()`.
**Where**: `features/auth/components/logout-button.tsx`
**Depends on**: T13
**Reuses**: shadcn `button`
**Requirement**: AUTH-03

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Click triggers logout mutation
- [x] Gate check passes: `npm run build`

**Tests**: none
**Gate**: build

---

### T18: `features/auth/index.ts` (public API)

**What**: Barrel file exporting `AuthProvider`, `LoginForm`, `SignUpForm`, `GoogleLoginButton`, `LogoutButton`, `useAuth`, and `types`.
**Where**: `features/auth/index.ts`
**Depends on**: T10, T14, T15, T16, T17
**Requirement**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] All public symbols exported per design.md
- [x] No other file outside `features/auth/` imports from `features/auth/{components,hooks,services,actions,types}` directly (only from `@/features/auth`)
- [x] Gate check passes: `npm run build`

**Tests**: none
**Gate**: build

---

### T19: `app/(auth)/layout.tsx` + `app/(auth)/login/page.tsx`

**What**: Minimal centered layout for the auth route group; login page composing `LoginForm`/`SignUpForm` (toggle) + `GoogleLoginButton`, reading `?redirect=` and passing it to the forms/button, calling `resolveGoogleRedirect()` once on mount.
**Where**: `app/(auth)/layout.tsx`, `app/(auth)/login/page.tsx`
**Depends on**: T18
**Reuses**: `@/features/auth` public API
**Requirement**: AUTH-01, AUTH-02, AUTH-05

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] URL is `/login` (route group doesn't leak into path)
- [x] Toggling between login/signup works client-side, no page reload
- [x] `?redirect=` param read and forwarded
- [x] Gate check passes: `npm run build`

**Tests**: none
**Gate**: build

---

### T20: Wire `AuthProvider` + `Toaster` into root layout

**What**: Update `app/layout.tsx`: nest `AuthProvider` inside `QueryProvider`, add shadcn `<Toaster />`.
**Where**: `app/layout.tsx`
**Depends on**: T18
**Requirement**: AUTH-04, AUTH-06

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Provider order: `ThemeProvider > QueryProvider > AuthProvider > children`
- [x] `<Toaster />` rendered once, at root
- [x] Gate check passes: `npm run build`

**Tests**: none
**Gate**: build

---

### T21: Final verification sweep

**What**: Full build + lint + unit test run; manual smoke test of the flows described in spec.md's Independent Test sections (login email, login Google, logout, reload-persists-session, protected-route-redirects, sign up, unmapped/mapped error toasts).
**Where**: N/A (verification only)
**Depends on**: T20
**Requirement**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `npm run build` → 0 errors
- [x] `npm run lint` → 0 errors
- [x] `npm run test` → all unit tests pass (mapFirebaseError, middleware-logic) — 13/13 passed, 2 test files
- [x] Manual smoke test — **NOT executed**: no real Firebase project is configured in this environment (`.env.local` holds placeholder values only, no valid service account / API key). Live login/logout/session-persistence/error-toast flows cannot be exercised. In lieu of the live smoke test, verified by static inspection: `proxy.ts` matcher excludes `_next/static`, `_next/image`, `favicon.ico`, `api/auth/session`, and static file extensions; `decideRedirect` (unit-tested) redirects unauthenticated protected requests to `/login?redirect=<pathname>` and authenticated `/login` requests to `/`; `app/layout.tsx` nests `ThemeProvider > QueryProvider > AuthProvider > children` with `<Toaster />` at root; `app/(auth)/login/page.tsx` reads `?redirect=`, toggles Login/SignUp client-side, calls `resolveRedirect()` once on mount; `features/auth/index.ts` exports all public symbols and no file outside `features/auth/` imports internals directly (grep-verified). This gap is documented as a limitation, not represented as a passed test.
- [x] Update `spec.md` traceability + `tasks.md` status

**Tests**: none (aggregation/verification task)
**Gate**: build (final — full sweep) — **PASS** (build clean, lint clean, unit tests 13/13; functional/manual verification blocked by missing real Firebase credentials, see note above)
