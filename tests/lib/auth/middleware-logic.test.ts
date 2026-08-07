import { describe, expect, it } from "vitest";

import { decideRedirect, isPublicPath } from "@/lib/auth/middleware-logic";

describe("isPublicPath", () => {
  it("treats /login as public", () => {
    expect(isPublicPath("/login")).toBe(true);
  });

  it("treats / as public", () => {
    expect(isPublicPath("/")).toBe(true);
  });

  it("treats other paths as protected", () => {
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

  it("/login + valid session → redirect to /home", () => {
    expect(
      decideRedirect({ pathname: "/login", hasValidSession: true }),
    ).toEqual({ action: "redirect", to: "/home" });
  });

  it("/login + invalid session → next", () => {
    expect(
      decideRedirect({ pathname: "/login", hasValidSession: false }),
    ).toEqual({ action: "next" });
  });

  it("/ + invalid session → next", () => {
    expect(
      decideRedirect({ pathname: "/", hasValidSession: false }),
    ).toEqual({ action: "next" });
  });

  it("/ + valid session → redirect to /home", () => {
    expect(
      decideRedirect({ pathname: "/", hasValidSession: true }),
    ).toEqual({ action: "redirect", to: "/home" });
  });
});
