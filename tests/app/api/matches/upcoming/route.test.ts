import { afterEach, describe, expect, it, vi } from "vitest";

const { getUpcomingMatchesPageMock, getCurrentFirebaseUidMock } = vi.hoisted(
  () => ({
    getUpcomingMatchesPageMock: vi.fn(),
    getCurrentFirebaseUidMock: vi.fn(),
  }),
);

vi.mock("@/features/matches", () => ({
  getUpcomingMatchesPage: getUpcomingMatchesPageMock,
}));

vi.mock("@/lib/auth/get-current-user", () => ({
  getCurrentFirebaseUid: getCurrentFirebaseUidMock,
}));

const { GET } = await import("@/app/api/matches/upcoming/route");

const PAGE = { groups: [], nextCursor: null };

afterEach(() => {
  vi.clearAllMocks();
});

function makeRequest(query = ""): Request {
  return new Request(`http://localhost/api/matches/upcoming${query}`);
}

describe("GET /api/matches/upcoming", () => {
  it("returns 200 with the page JSON on success", async () => {
    getCurrentFirebaseUidMock.mockResolvedValue("firebase-1");
    getUpcomingMatchesPageMock.mockResolvedValue(PAGE);

    const response = await GET(makeRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(PAGE);
  });

  it("passes cursor and limit query params through to the service", async () => {
    getCurrentFirebaseUidMock.mockResolvedValue(null);
    getUpcomingMatchesPageMock.mockResolvedValue(PAGE);

    await GET(
      makeRequest(
        "?cursorMatchDate=2026-08-01T15:00:00.000Z&cursorId=11111111-1111-4111-8111-111111111111&limit=5",
      ),
    );

    expect(getUpcomingMatchesPageMock).toHaveBeenCalledWith({
      firebaseUid: null,
      cursor: {
        matchDate: "2026-08-01T15:00:00.000Z",
        id: "11111111-1111-4111-8111-111111111111",
      },
      limit: 5,
    });
  });

  it("defaults cursor to null when cursor params are absent", async () => {
    getCurrentFirebaseUidMock.mockResolvedValue(null);
    getUpcomingMatchesPageMock.mockResolvedValue(PAGE);

    await GET(makeRequest());

    expect(getUpcomingMatchesPageMock).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: null }),
    );
  });

  it("ignores a malformed cursor instead of passing it through unsanitized", async () => {
    getCurrentFirebaseUidMock.mockResolvedValue(null);
    getUpcomingMatchesPageMock.mockResolvedValue(PAGE);

    await GET(
      makeRequest(
        "?cursorMatchDate=not-a-date&cursorId=not-a-uuid,and(injected)",
      ),
    );

    expect(getUpcomingMatchesPageMock).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: null }),
    );
  });

  it("clamps limit to the maximum and falls back to the default when invalid", async () => {
    getCurrentFirebaseUidMock.mockResolvedValue(null);
    getUpcomingMatchesPageMock.mockResolvedValue(PAGE);

    await GET(makeRequest("?limit=100000"));
    expect(getUpcomingMatchesPageMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ limit: 50 }),
    );

    await GET(makeRequest("?limit=-5"));
    expect(getUpcomingMatchesPageMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ limit: 10 }),
    );
  });

  it("returns 500 with an error message when the service throws", async () => {
    getCurrentFirebaseUidMock.mockResolvedValue(null);
    getUpcomingMatchesPageMock.mockRejectedValue(new Error("supabase down"));

    const response = await GET(makeRequest());

    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: string };
    expect(body.error).not.toContain("supabase down");
  });
});
