import { afterEach, describe, expect, it, vi } from "vitest";

const { verifyIdTokenMock, createSessionCookieMock, fromMock, cookieSetMock } =
  vi.hoisted(() => ({
    verifyIdTokenMock: vi.fn(),
    createSessionCookieMock: vi.fn(),
    fromMock: vi.fn(),
    cookieSetMock: vi.fn(),
  }));

vi.mock("@/lib/firebase/admin", () => ({
  adminAuth: {
    verifyIdToken: verifyIdTokenMock,
    createSessionCookie: createSessionCookieMock,
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: fromMock },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ set: cookieSetMock }),
}));

const { POST } = await import("@/app/api/auth/session/route");

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/auth/session", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function mockUpsert(result: { error: unknown }) {
  const upsert = vi.fn(() => Promise.resolve(result));
  fromMock.mockReturnValue({ upsert });
  return upsert;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/auth/session", () => {
  it("returns 401 without verifying anything when idToken is missing", async () => {
    const response = await POST(makeRequest({}));

    expect(response.status).toBe(401);
    expect(verifyIdTokenMock).not.toHaveBeenCalled();
  });

  it("returns 401 when the idToken fails verification", async () => {
    verifyIdTokenMock.mockRejectedValue(new Error("invalid token"));

    const response = await POST(makeRequest({ idToken: "bad-token" }));

    expect(response.status).toBe(401);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("upserts a users row (ignoring duplicates) with the decoded profile fields", async () => {
    verifyIdTokenMock.mockResolvedValue({
      uid: "firebase-uid-1",
      email: "user@example.com",
      name: "User Name",
      picture: "https://example.com/avatar.png",
    });
    createSessionCookieMock.mockResolvedValue("session-cookie-value");
    const upsert = mockUpsert({ error: null });

    const response = await POST(makeRequest({ idToken: "good-token" }));

    expect(fromMock).toHaveBeenCalledWith("users");
    expect(upsert).toHaveBeenCalledWith(
      {
        firebase_uid: "firebase-uid-1",
        email: "user@example.com",
        display_name: "User Name",
        avatar_url: "https://example.com/avatar.png",
      },
      { onConflict: "firebase_uid", ignoreDuplicates: true },
    );
    expect(response.status).toBe(204);
    expect(cookieSetMock).toHaveBeenCalledWith(
      "__session",
      "session-cookie-value",
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it("falls back to null profile fields when the token carries no email/name/picture", async () => {
    verifyIdTokenMock.mockResolvedValue({ uid: "firebase-uid-2" });
    createSessionCookieMock.mockResolvedValue("session-cookie-value");
    const upsert = mockUpsert({ error: null });

    await POST(makeRequest({ idToken: "good-token" }));

    expect(upsert).toHaveBeenCalledWith(
      {
        firebase_uid: "firebase-uid-2",
        email: null,
        display_name: null,
        avatar_url: null,
      },
      { onConflict: "firebase_uid", ignoreDuplicates: true },
    );
  });

  it("returns 500 and never sets the cookie when the upsert fails", async () => {
    verifyIdTokenMock.mockResolvedValue({ uid: "firebase-uid-1" });
    createSessionCookieMock.mockResolvedValue("session-cookie-value");
    mockUpsert({ error: new Error("supabase down") });

    const response = await POST(makeRequest({ idToken: "good-token" }));

    expect(response.status).toBe(500);
    expect(cookieSetMock).not.toHaveBeenCalled();
  });
});
