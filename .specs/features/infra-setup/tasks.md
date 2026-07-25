# Infra Setup Tasks

**Design**: inline (Medium scope — see context.md and spec.md)
**Status**: Done

---

## Execution Plan

### Phase 1: Foundation (Sequential) — **Est. tokens**: ~15k

```
T1 → T2
```

### Phase 2: Core Config (Parallel OK) — **Est. tokens**: ~60k

```
        ┌→ T3 (shadcn init) ─┐
        ├→ T4 (env.ts) ───────┼→ T5 (firebase client)
T2 ─────┼→ T4 ───────────────┼→ T6 (supabase client)
        ├→ T7 (query-keys)   │
        ├→ T8 (prettier)     │
        └→ T9 (theme provider setup files)
```

_(T5 and T6 depend on T4; T3, T7, T8, T9 depend only on T2 and are mutually independent.)_

### Phase 3: Integration (Sequential) — **Est. tokens**: ~25k

```
T3, T5, T6, T7, T9 → T10 → T11
```

---

## Task Breakdown

### T1: Install all dependencies

**What**: Single `npm install` adding shadcn deps, React Query, RHF, Zod, Firebase, Supabase, next-themes, `@t3-oss/env-nextjs`, Prettier + Tailwind plugin, and shadcn CLI peer deps.
**Where**: `package.json`, `package-lock.json`
**Depends on**: None
**Requirement**: SETUP-01, SETUP-02, SETUP-04, SETUP-05

**Tools**:

- MCP: NONE
- Skill: `search` (if version compatibility with Next 16 / React 19 unclear)

**Done when**:

- [x] `@tanstack/react-query`, `@tanstack/react-query-devtools` installed
- [x] `react-hook-form`, `@hookform/resolvers`, `zod` installed
- [x] `firebase` installed
- [x] `@supabase/supabase-js` installed
- [x] `next-themes` installed
- [x] `@t3-oss/env-nextjs` installed
- [x] `prettier`, `prettier-plugin-tailwindcss` installed (devDependencies)
- [x] Gate check passes: `npm install` exits 0, no peer-dep errors (used `--legacy-peer-deps`: `@hookform/resolvers@5.4.3` has an internal transitive optional-peer conflict between its own optional `@typeschema/main`→`valibot@^0.39.0` chain and its own optional `valibot@^1.0.0` peer — unrelated to our chosen versions)

**Tests**: none
**Gate**: build (verify no install-time conflict)

---

### T2: Create folder skeleton

**What**: Create empty/placeholder folders: `components/ui/`, `lib/`, `features/`, `config/`, `hooks/`.
**Where**: `components/ui/.gitkeep`, `lib/.gitkeep` (removed once files land), `features/README.md`, `config/`, `hooks/.gitkeep`
**Depends on**: T1
**Requirement**: SETUP-03

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] All 5 directories exist and are tracked by git (placeholder file where empty)
- [x] `features/README.md` explains the public-API-per-feature convention (one line, per CLAUDE.md)
- [x] Gate check passes: `git status` shows directories present

**Tests**: none
**Gate**: build

---

### T3: shadcn/ui init [P]

**What**: Run shadcn CLI init with style `new-york`, base color `neutral`; produces `components.json` and base `lib/utils.ts`; add one test component (`button`) to prove the pipeline works.
**Where**: `components.json`, `lib/utils.ts`, `components/ui/button.tsx`, `app/globals.css` (CSS vars)
**Depends on**: T2
**Reuses**: existing `app/globals.css`, Tailwind v4 config
**Requirement**: SETUP-01

**Tools**:

- MCP: NONE
- Skill: `search` (verify shadcn CLI flags/current API for Tailwind v4 + Next 16)

**Done when**:

- [x] `components.json` has `style: "new-york"`, `baseColor: "neutral"`, aliases matching `@/*`
- [x] `npx shadcn@latest add button` runs clean (already run as part of this task)
- [x] Gate check passes: `npm run build`

**Tests**: none
**Gate**: build

---

### T4: Env validation schema [P]

**What**: Create `lib/env.ts` using `@t3-oss/env-nextjs` + `zod`, defining `server` vars (Supabase service role if any, Firebase server-only if any) and `client` vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_FIREBASE_*`). Add `.env.example` documenting every var.
**Where**: `lib/env.ts`, `.env.example`
**Depends on**: T2
**Requirement**: SETUP-02

**Tools**:

- MCP: NONE
- Skill: `search` (confirm `@t3-oss/env-nextjs` current API)

**Done when**:

- [x] `lib/env.ts` exports validated `env` object, throws clear error if a required var is missing
- [x] `.env.example` lists all vars with placeholder values and comments
- [x] Gate check passes: `npm run build` fails clearly if `.env.local` is missing a required var (manually verified once, then restored)

**Tests**: none
**Gate**: build

---

### T5: Firebase client (Auth)

**What**: Create `lib/firebase/client.ts` initializing Firebase app (guarded against re-init in dev/HMR) and exporting `auth` (Firebase Authentication instance), reading config from `lib/env.ts`.
**Where**: `lib/firebase/client.ts`
**Depends on**: T4
**Reuses**: `lib/env.ts`
**Requirement**: SETUP-02

**Tools**:

- MCP: NONE
- Skill: `search` (Firebase JS SDK v10+ modular init pattern for Next.js)

**Done when**:

- [x] `lib/firebase/client.ts` exports `auth` initialized once (no duplicate-app error on HMR)
- [x] Import compiles: `npm run build`
- [x] Gate check passes: `npm run build`

**Tests**: none
**Gate**: build

---

### T6: Supabase client (DB/Storage)

**What**: Create `lib/supabase/client.ts` exporting a browser Supabase client via `createClient` from `@supabase/supabase-js`, reading config from `lib/env.ts`.
**Where**: `lib/supabase/client.ts`
**Depends on**: T4
**Reuses**: `lib/env.ts`
**Requirement**: SETUP-02

**Tools**:

- MCP: NONE
- Skill: `search` (current `@supabase/supabase-js` client creation pattern for Next.js App Router)

**Done when**:

- [x] `lib/supabase/client.ts` exports a singleton client
- [x] Import compiles: `npm run build`
- [x] Gate check passes: `npm run build`

**Tests**: none
**Gate**: build

---

### T7: Query keys + Query Provider [P]

**What**: Create `config/query-keys.ts` with placeholder `QUERY_KEYS` object, and `config/providers/query-provider.tsx` — a Client Component wrapping children in `QueryClientProvider`, rendering `ReactQueryDevtools` only when `process.env.NODE_ENV !== "production"`.
**Where**: `config/query-keys.ts`, `config/providers/query-provider.tsx`
**Depends on**: T2
**Requirement**: SETUP-02, SETUP-03

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `QueryProvider` creates one `QueryClient` instance per component lifetime (not per render)
- [x] Devtools excluded from production render path
- [x] Gate check passes: `npm run build`

**Tests**: none
**Gate**: build

---

### T8: Prettier config [P]

**What**: Add `.prettierrc` (or `prettier.config.js`) with `prettier-plugin-tailwindcss` enabled; add `format`/`format:check` scripts to `package.json`; ensure no rule conflict with `eslint.config.mjs`.
**Where**: `.prettierrc`, `package.json`
**Depends on**: T2
**Requirement**: SETUP-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `npx prettier --write` reorders a deliberately-scrambled Tailwind class list correctly
- [x] `npm run lint` still passes (no conflicting rules)
- [x] Gate check passes: `npm run lint`

**Tests**: none
**Gate**: build

---

### T9: Theme Provider [P]

**What**: Create `config/providers/theme-provider.tsx` wrapping `next-themes`' `ThemeProvider` with `attribute="class"`, `defaultTheme="system"`, `enableSystem`.
**Where**: `config/providers/theme-provider.tsx`
**Depends on**: T2
**Requirement**: SETUP-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Component compiles and accepts `children`
- [x] Gate check passes: `npm run build`

**Tests**: none
**Gate**: build

---

### T10: Wire providers into root layout

**What**: Update `app/layout.tsx` to wrap `{children}` with `ThemeProvider` (outer) then `QueryProvider` (inner), preserving existing `<html>`/`<body>` structure and fonts.
**Where**: `app/layout.tsx`
**Depends on**: T3, T5, T6, T7, T9
**Requirement**: SETUP-02, SETUP-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `npm run dev` starts, page renders without hydration mismatch warnings
- [x] Gate check passes: `npm run build`

**Tests**: none
**Gate**: build

---

### T11: Final verification sweep

**What**: Run full build + lint + format check; confirm `.env.example` covers every var consumed by `lib/env.ts`; confirm no business logic was introduced.
**Where**: N/A (verification only)
**Depends on**: T10
**Requirement**: SETUP-01, SETUP-02, SETUP-03, SETUP-04, SETUP-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `npm run build` → 0 errors
- [x] `npm run lint` → 0 errors
- [x] `npx prettier --check .` → 0 issues
- [x] Update `spec.md` traceability + `tasks.md` status

**Tests**: none
**Gate**: build (final — full sweep)
