import { afterEach, describe, expect, it, vi } from "vitest";

const { getCurrentFirebaseUidMock, resolveUserIdMock, upsertPredictionMock } =
  vi.hoisted(() => ({
    getCurrentFirebaseUidMock: vi.fn(),
    resolveUserIdMock: vi.fn(),
    upsertPredictionMock: vi.fn(),
  }));

vi.mock("@/lib/auth/get-current-user", () => ({
  getCurrentFirebaseUid: getCurrentFirebaseUidMock,
}));

vi.mock("@/features/matches/services/_shared", () => ({
  resolveUserId: resolveUserIdMock,
}));

vi.mock("@/features/matches/services/upsert-prediction", () => ({
  upsertPrediction: upsertPredictionMock,
}));

import { submitPrediction } from "@/features/matches/actions/predictions";

const INPUT = {
  matchId: "11111111-1111-4111-8111-111111111111",
  predictedHomeScore: 2,
  predictedAwayScore: 1,
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("submitPrediction", () => {
  it("rejects invalid input before checking auth or calling the service", async () => {
    const result = await submitPrediction({
      ...INPUT,
      predictedHomeScore: -1,
    });

    expect(result).toEqual({ ok: false, error: "entrada inválida" });
    expect(getCurrentFirebaseUidMock).not.toHaveBeenCalled();
    expect(upsertPredictionMock).not.toHaveBeenCalled();
  });

  it("rejects a non-uuid matchId", async () => {
    const result = await submitPrediction({ ...INPUT, matchId: "match-1" });

    expect(result).toEqual({ ok: false, error: "entrada inválida" });
    expect(upsertPredictionMock).not.toHaveBeenCalled();
  });

  it("returns not-authenticated and never calls the service when there is no session", async () => {
    getCurrentFirebaseUidMock.mockResolvedValue(null);

    const result = await submitPrediction(INPUT);

    expect(result).toEqual({ ok: false, error: "não autenticado" });
    expect(upsertPredictionMock).not.toHaveBeenCalled();
  });

  it("returns not-authenticated when the firebase uid has no matching users row", async () => {
    getCurrentFirebaseUidMock.mockResolvedValue("firebase-1");
    resolveUserIdMock.mockResolvedValue(null);

    const result = await submitPrediction(INPUT);

    expect(result).toEqual({ ok: false, error: "não autenticado" });
    expect(upsertPredictionMock).not.toHaveBeenCalled();
  });

  it("resolves users.id and delegates to upsertPrediction, returning its result verbatim", async () => {
    getCurrentFirebaseUidMock.mockResolvedValue("firebase-1");
    resolveUserIdMock.mockResolvedValue("user-1");
    upsertPredictionMock.mockResolvedValue({ ok: true });

    const result = await submitPrediction(INPUT);

    expect(result).toEqual({ ok: true });
    expect(upsertPredictionMock).toHaveBeenCalledWith({
      userId: "user-1",
      matchId: "11111111-1111-4111-8111-111111111111",
      predictedHomeScore: 2,
      predictedAwayScore: 1,
      wageredAmount: undefined,
    });
  });

  it("rejects a wageredAmount <= 0 before checking auth or calling the service", async () => {
    const result = await submitPrediction({ ...INPUT, wageredAmount: 0 });

    expect(result).toEqual({ ok: false, error: "entrada inválida" });
    expect(getCurrentFirebaseUidMock).not.toHaveBeenCalled();
    expect(upsertPredictionMock).not.toHaveBeenCalled();
  });

  it("passes a valid wageredAmount through to upsertPrediction", async () => {
    getCurrentFirebaseUidMock.mockResolvedValue("firebase-1");
    resolveUserIdMock.mockResolvedValue("user-1");
    upsertPredictionMock.mockResolvedValue({ ok: true });

    const result = await submitPrediction({ ...INPUT, wageredAmount: 25.5 });

    expect(result).toEqual({ ok: true });
    expect(upsertPredictionMock).toHaveBeenCalledWith({
      userId: "user-1",
      matchId: "11111111-1111-4111-8111-111111111111",
      predictedHomeScore: 2,
      predictedAwayScore: 1,
      wageredAmount: 25.5,
    });
  });

  it("propagates a service failure result verbatim", async () => {
    getCurrentFirebaseUidMock.mockResolvedValue("firebase-1");
    resolveUserIdMock.mockResolvedValue("user-1");
    upsertPredictionMock.mockResolvedValue({
      ok: false,
      error: "partida já começou",
    });

    const result = await submitPrediction(INPUT);

    expect(result).toEqual({ ok: false, error: "partida já começou" });
  });
});
