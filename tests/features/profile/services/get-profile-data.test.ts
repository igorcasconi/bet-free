import { afterEach, describe, expect, it, vi } from "vitest";

import { getProfileData } from "@/features/profile/services/get-profile-data";
import { getAccuracyPercent } from "@/lib/predictions/accuracy";
import { getUserAchievements } from "@/features/profile/services/get-user-achievements";
import { getLatestPredictions } from "@/features/dashboard";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: fromMock },
}));

vi.mock("@/lib/predictions/accuracy", () => ({
  getAccuracyPercent: vi.fn(),
}));

vi.mock("@/features/profile/services/get-user-achievements", () => ({
  getUserAchievements: vi.fn(),
}));

vi.mock("@/features/dashboard", () => ({
  getLatestPredictions: vi.fn(),
}));

const getAccuracyPercentMock = vi.mocked(getAccuracyPercent);
const getUserAchievementsMock = vi.mocked(getUserAchievements);
const getLatestPredictionsMock = vi.mocked(getLatestPredictions);

interface QueryResult {
  data: unknown;
  error: unknown;
}

function createBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;

  builder.select = vi.fn(chain);
  builder.eq = vi.fn(chain);
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));

  return builder;
}

function setupUsers(result: QueryResult): void {
  fromMock.mockImplementation((table: string) => {
    if (table === "users") return createBuilder(result);
    throw new Error(`Unexpected table: ${table}`);
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("getProfileData", () => {
  it("returns zeroed ProfileData and skips the users query when firebaseUid is null", async () => {
    const result = await getProfileData(null);

    expect(result).toEqual({
      identity: { displayName: null, email: null, avatarUrl: null },
      stats: {
        moneySaved: 0,
        currentStreak: 0,
        level: 1,
        xpInLevel: 0,
        xpToNextLevel: 3000,
        accuracyPercent: 0,
      },
      achievements: [],
      latestPredictions: [],
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns zeroed ProfileData when no user row is found", async () => {
    setupUsers({ data: null, error: null });

    const result = await getProfileData("missing-uid");

    expect(result).toEqual({
      identity: { displayName: null, email: null, avatarUrl: null },
      stats: {
        moneySaved: 0,
        currentStreak: 0,
        level: 1,
        xpInLevel: 0,
        xpToNextLevel: 3000,
        accuracyPercent: 0,
      },
      achievements: [],
      latestPredictions: [],
    });
    expect(getAccuracyPercentMock).not.toHaveBeenCalled();
    expect(getUserAchievementsMock).not.toHaveBeenCalled();
    expect(getLatestPredictionsMock).not.toHaveBeenCalled();
  });

  it("assembles ProfileData from user row and the 3 dependent functions when found", async () => {
    setupUsers({
      data: {
        id: "user-1",
        display_name: "Igor Casconi",
        avatar_url: "https://example.com/avatar.png",
        email: "igor@example.com",
        money_saved: 4380,
        current_streak: 23,
        xp: 2340,
      },
      error: null,
    });
    getAccuracyPercentMock.mockResolvedValue(67);
    getUserAchievementsMock.mockResolvedValue([
      {
        id: "ach-1",
        name: "First Prediction",
        description: "Made your first prediction",
        iconUrl: null,
        earnedAt: "2026-07-01T00:00:00.000Z",
      },
    ]);
    getLatestPredictionsMock.mockResolvedValue([
      {
        id: "pred-1",
        matchLabel: "Flamengo vs Palmeiras",
        predictedScore: "2-1",
        createdAt: "2026-07-25T12:00:00.000Z",
      },
    ]);

    const result = await getProfileData("uid-1");

    expect(result.identity).toEqual({
      displayName: "Igor Casconi",
      email: "igor@example.com",
      avatarUrl: "https://example.com/avatar.png",
    });
    expect(result.stats).toEqual({
      moneySaved: 4380,
      currentStreak: 23,
      level: 1,
      xpInLevel: 2340,
      xpToNextLevel: 3000,
      accuracyPercent: 67,
    });
    expect(result.achievements).toHaveLength(1);
    expect(result.latestPredictions).toHaveLength(1);
    expect(getAccuracyPercentMock).toHaveBeenCalledWith("user-1");
    expect(getUserAchievementsMock).toHaveBeenCalledWith("user-1");
    expect(getLatestPredictionsMock).toHaveBeenCalledWith("user-1");
  });

  it("passes through null identity fields as null (not coerced)", async () => {
    setupUsers({
      data: {
        id: "user-1",
        display_name: null,
        avatar_url: null,
        email: null,
        money_saved: 0,
        current_streak: 0,
        xp: 0,
      },
      error: null,
    });
    getAccuracyPercentMock.mockResolvedValue(0);
    getUserAchievementsMock.mockResolvedValue([]);
    getLatestPredictionsMock.mockResolvedValue([]);

    const result = await getProfileData("uid-1");

    expect(result.identity).toEqual({
      displayName: null,
      email: null,
      avatarUrl: null,
    });
  });

  it("propagates errors from the users query", async () => {
    setupUsers({ data: null, error: new Error("supabase down") });

    await expect(getProfileData("uid-1")).rejects.toThrow("supabase down");
  });
});
