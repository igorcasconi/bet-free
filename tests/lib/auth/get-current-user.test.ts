import { beforeEach, describe, expect, it, vi } from "vitest";

const { verifySessionCookie, cookiesGet } = vi.hoisted(() => ({
  verifySessionCookie: vi.fn(),
  cookiesGet: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: cookiesGet,
  })),
}));

vi.mock("@/lib/firebase/admin", () => ({
  adminAuth: {
    verifySessionCookie,
  },
}));

import { getCurrentFirebaseUid } from "@/lib/auth/get-current-user";

describe("getCurrentFirebaseUid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns uid when the session cookie is valid", async () => {
    cookiesGet.mockReturnValue({ value: "valid-session-cookie" });
    verifySessionCookie.mockResolvedValue({ uid: "user-123" });

    const uid = await getCurrentFirebaseUid();

    expect(uid).toBe("user-123");
    expect(verifySessionCookie).toHaveBeenCalledWith("valid-session-cookie");
  });

  it("returns null when the session cookie is absent", async () => {
    cookiesGet.mockReturnValue(undefined);

    const uid = await getCurrentFirebaseUid();

    expect(uid).toBeNull();
    expect(verifySessionCookie).not.toHaveBeenCalled();
  });

  it("returns null when verifySessionCookie rejects", async () => {
    cookiesGet.mockReturnValue({ value: "expired-session-cookie" });
    verifySessionCookie.mockRejectedValue(new Error("Invalid session cookie"));

    const uid = await getCurrentFirebaseUid();

    expect(uid).toBeNull();
  });
});
