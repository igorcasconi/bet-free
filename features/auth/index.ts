export * from "./components/auth-provider";
export * from "./components/login-form";
export * from "./components/sign-up-form";
export * from "./components/google-login-button";
export * from "./components/logout-button";
export * from "./hooks/use-auth";
// SPEC_DEVIATION: not listed in design.md's public API table — exported
// because app/(auth)/login/page.tsx needs resolveRedirect() to complete the
// Google redirect flow on mount, and the "never import feature internals
// directly" rule leaves the barrel as the only valid way to reach it.
export * from "./hooks/use-login-with-google";
export * from "./types";
