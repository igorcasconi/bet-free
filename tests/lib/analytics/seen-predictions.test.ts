import { beforeEach, describe, expect, it, vi } from "vitest";

import { markPredictionSeen } from "@/lib/analytics/seen-predictions";

function stubLocalStorage(overrides: Partial<Storage> = {}) {
  const store = new Map<string, string>();

  const localStorage = {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    ...overrides,
  };

  vi.stubGlobal("localStorage", localStorage);
  vi.stubGlobal("window", { localStorage });

  return localStorage;
}

describe("markPredictionSeen", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns true for a new prediction ID and persists it", () => {
    const localStorage = stubLocalStorage();

    const result = markPredictionSeen("pred-1");

    expect(result).toBe(true);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "analytics_seen_predictions",
      JSON.stringify(["pred-1"]),
    );
  });

  it("returns false when the same ID is seen again", () => {
    stubLocalStorage();

    markPredictionSeen("pred-1");
    const result = markPredictionSeen("pred-1");

    expect(result).toBe(false);
  });

  it("tracks two different IDs independently", () => {
    stubLocalStorage();

    expect(markPredictionSeen("pred-1")).toBe(true);
    expect(markPredictionSeen("pred-2")).toBe(true);
    expect(markPredictionSeen("pred-1")).toBe(false);
    expect(markPredictionSeen("pred-2")).toBe(false);
  });

  it("returns true and does not throw when localStorage.getItem throws", () => {
    stubLocalStorage({
      getItem: vi.fn(() => {
        throw new Error("private browsing restriction");
      }),
    });

    expect(() => markPredictionSeen("pred-1")).not.toThrow();
    expect(markPredictionSeen("pred-1")).toBe(true);
  });

  it("returns true and does not throw when localStorage.setItem throws", () => {
    stubLocalStorage({
      setItem: vi.fn(() => {
        throw new Error("quota exceeded");
      }),
    });

    expect(() => markPredictionSeen("pred-1")).not.toThrow();
    expect(markPredictionSeen("pred-1")).toBe(true);
  });
});
