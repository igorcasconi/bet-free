import { describe, expect, it } from "vitest";

import { mapFirebaseError } from "@/features/auth/services/auth-service";

describe("mapFirebaseError", () => {
  it.each([
    ["auth/invalid-credential", "Email ou senha incorretos"],
    ["auth/user-not-found", "Email ou senha incorretos"],
    ["auth/wrong-password", "Email ou senha incorretos"],
    ["auth/email-already-in-use", "Este email já está cadastrado"],
    [
      "auth/too-many-requests",
      "Muitas tentativas. Tente novamente mais tarde.",
    ],
  ])("maps %s to a friendly message", (code, message) => {
    expect(mapFirebaseError({ code })).toBe(message);
  });

  it("falls back to a generic message for unmapped codes", () => {
    expect(mapFirebaseError({ code: "auth/network-request-failed" })).toBe(
      "Algo deu errado, tente novamente",
    );
  });

  it("falls back to a generic message for non-Firebase errors", () => {
    expect(mapFirebaseError(new Error("boom"))).toBe(
      "Algo deu errado, tente novamente",
    );
  });
});
