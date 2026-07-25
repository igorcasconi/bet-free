import { describe, expect, it } from "vitest";

import { decideRedirect, isPublicPath } from "@/lib/auth/middleware-logic";

describe("isPublicPath", () => {
  it("treats /login as public", () => {
    expect(isPublicPath("/login")).toBe(true);
  });

  it("treats other paths as protected", () => {
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/dashboard")).toBe(false);
  });
});

describe("decideRedirect", () => {
  it("protected path + valid session → next", () => {
    expect(
      decideRedirect({ pathname: "/dashboard", hasValidSession: true }),
    ).toEqual({ action: "next" });
  });

  it("protected path + invalid session → redirect to /login with redirect param", () => {
    expect(
      decideRedirect({ pathname: "/dashboard", hasValidSession: false }),
    ).toEqual({ action: "redirect", to: "/login?redirect=%2Fdashboard" });
  });

  it("/login + valid session → redirect to /", () => {
    expect(
      decideRedirect({ pathname: "/login", hasValidSession: true }),
    ).toEqual({ action: "redirect", to: "/" });
  });

  it("/login + invalid session → next", () => {
    expect(
      decideRedirect({ pathname: "/login", hasValidSession: false }),
    ).toEqual({ action: "next" });
  });
});
