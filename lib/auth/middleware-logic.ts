const PUBLIC_PATHS = ["/login"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname);
}

export type MiddlewareDecision =
  | { action: "next" }
  | { action: "redirect"; to: string };

export function decideRedirect({
  pathname,
  hasValidSession,
}: {
  pathname: string;
  hasValidSession: boolean;
}): MiddlewareDecision {
  if (isPublicPath(pathname)) {
    return hasValidSession ? { action: "redirect", to: "/" } : { action: "next" };
  }

  if (hasValidSession) {
    return { action: "next" };
  }

  const redirectUrl = `/login?redirect=${encodeURIComponent(pathname)}`;
  return { action: "redirect", to: redirectUrl };
}
