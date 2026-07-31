import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createThrottledFetchJson,
  fetchJson,
} from "@/lib/sports-provider/http";
import { SportsProviderError } from "@/lib/sports-provider/types";

describe("fetchJson", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws SportsProviderError on network failure", async () => {
    const cause = new Error("network down");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(cause));

    await expect(fetchJson("https://example.com")).rejects.toMatchObject({
      name: "SportsProviderError",
      message: "Failed to reach sports provider API",
      cause,
    });
    expect(fetchJson("https://example.com")).rejects.toBeInstanceOf(
      SportsProviderError,
    );
  });

  it("throws SportsProviderError on non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503 }),
    );

    await expect(fetchJson("https://example.com")).rejects.toMatchObject({
      name: "SportsProviderError",
      message: "Sports provider API responded with status 503",
    });
  });

  it("throws SportsProviderError on JSON parse failure", async () => {
    const cause = new Error("bad json");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockRejectedValue(cause),
      }),
    );

    await expect(fetchJson("https://example.com")).rejects.toMatchObject({
      name: "SportsProviderError",
      message: "Failed to parse sports provider API response as JSON",
      cause,
    });
  });

  it("resolves with parsed JSON and passes headers to fetch when provided", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ hello: "world" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await fetchJson("https://example.com", {
      Authorization: "Bearer token",
    });

    expect(result).toEqual({ hello: "world" });
    expect(mockFetch).toHaveBeenCalledWith("https://example.com", {
      headers: { Authorization: "Bearer token" },
    });
  });
});

describe("createThrottledFetchJson", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("fires the first call immediately", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ ok: true }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const throttled = createThrottledFetchJson(1000);
    const promise = throttled("https://example.com");
    await vi.advanceTimersByTimeAsync(0);

    await expect(promise).resolves.toEqual({ ok: true });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("delays a call fired before minIntervalMs has elapsed since the previous call", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ ok: true }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const throttled = createThrottledFetchJson(1000);
    await throttled("https://example.com");
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const second = throttled("https://example.com");
    await vi.advanceTimersByTimeAsync(500);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(500);
    await second;
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("does not delay when minIntervalMs has already elapsed since the previous call", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ ok: true }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const throttled = createThrottledFetchJson(1000);
    await throttled("https://example.com");
    expect(mockFetch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);

    const second = throttled("https://example.com");
    await vi.advanceTimersByTimeAsync(0);
    await second;
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
