...

# State Management

This project follows a server-first architecture.

Preferred order:

1. Server Components
2. Server Actions
3. React Query
4. React State
5. URL Search Params

Avoid global state unless absolutely necessary.

Context API should only be used for:

- Theme
- Authentication Session
- User Preferences

Do not use Context API for server data.

---

# React Query

This project uses **@tanstack/react-query** as the standard library for client-side server state management.

React Query should be used whenever client-side API communication is required.

Examples:

- Infinite scroll
- Pagination
- Filters
- Search
- Polling
- Background refetch
- Optimistic updates
- Cache invalidation

Do not use useEffect + fetch for API requests.

Always prefer:

```
Server Component

↓

Fetch Data

↓

Render
```

When the data needs to become interactive after hydration, use React Query.

Recommended structure inside each feature:

```
features/

matches/

├── api/
│   ├── get-matches.ts
│   ├── get-live-matches.ts
│   └── create-prediction.ts
│
├── hooks/
│   ├── useMatches.ts
│   ├── useLiveMatches.ts
│   └── useCreatePrediction.ts
```

Query Keys should be centralized.

Example:

```
constants/

query-keys.ts
```

```ts
export const QUERY_KEYS = {
  MATCHES: ["matches"],
  PREDICTIONS: ["predictions"],
  RANKINGS: ["rankings"],
  PROFILE: ["profile"],
  ACHIEVEMENTS: ["achievements"],
} as const;
```

Always invalidate queries after successful mutations.

Example:

```
createPrediction()

↓

invalidateQueries(MATCHES)

↓

invalidateQueries(PREDICTIONS)
```

---

# Data Fetching Strategy

Use the following decision tree.

✅ Server Component

- Static data
- SEO
- Initial page load
- Dashboard
- Match Details
- Rankings

✅ React Query

- Search
- Filters
- Live updates
- Pagination
- Refresh button
- Client mutations

✅ Server Actions

- Create Prediction
- Login
- Logout
- Update Profile

Avoid duplicated fetching between Server Components and React Query.

Hydrate React Query whenever server data is already available.

---

# Feature Public API

Every feature should expose a public API using an index.ts file.

Example:

```
features/

matches/

├── components/
├── hooks/
├── services/
├── actions/
├── api/
├── index.ts
```

Example:

```ts
export * from "./components";
export * from "./hooks";
export * from "./actions";
```

Never import internal files directly from another feature.

Good:

```ts
import { MatchCard } from "@/features/matches";
```

Bad:

```ts
import { MatchCard } from "@/features/matches/components/match-card";
```

---

# Domain First

This project is domain-driven.

Every new feature should answer:

- Which business problem does it solve?
- Which feature owns this logic?
- Can this logic be reused?
- Does it belong to a shared module?

Avoid creating generic abstractions before they are needed.

Business logic should always remain close to its feature.

Shared code should only exist when it is genuinely reusable across multiple domains.

Optimize for readability and maintainability over premature abstraction.

---

# General Principles

- Feature-first architecture.
- Prefer Server Components.
- Keep business logic inside features.
- Keep components presentation-only.
- Never fetch data directly inside UI components.
- Never call external APIs directly from components.
- Always type API responses.
- Prefer composition over inheritance.
- Avoid duplicated code.
- Avoid premature optimization.
- Prefer explicit code over clever code.
- Write code that is easy to delete, easy to test and easy to evolve.
