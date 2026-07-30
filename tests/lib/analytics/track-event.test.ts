import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { isSupportedMock, getAnalyticsMock, logEventMock } = vi.hoisted(() => ({
  isSupportedMock: vi.fn(),
  getAnalyticsMock: vi.fn(),
  logEventMock: vi.fn(),
}));

vi.mock("firebase/analytics", () => ({
  isSupported: isSupportedMock,
  getAnalytics: getAnalyticsMock,
  logEvent: logEventMock,
}));

vi.mock("@/lib/firebase/client", () => ({
  firebaseApp: {},
}));

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("trackEvent", () => {
  beforeEach(() => {
    vi.resetModules();
    isSupportedMock.mockReset();
    getAnalyticsMock.mockReset();
    logEventMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("no-ops without calling logEvent when window is undefined (SSR)", async () => {
    const { trackEvent } = await import("@/lib/analytics/track-event");

    trackEvent("login");
    await flushMicrotasks();

    expect(isSupportedMock).not.toHaveBeenCalled();
    expect(logEventMock).not.toHaveBeenCalled();
  });

  it("no-ops and never calls logEvent when isSupported() resolves false", async () => {
    vi.stubGlobal("window", {});
    isSupportedMock.mockResolvedValue(false);
    const { trackEvent } = await import("@/lib/analytics/track-event");

    trackEvent("login");
    trackEvent("matches_viewed");
    await flushMicrotasks();

    expect(isSupportedMock).toHaveBeenCalledTimes(1);
    expect(getAnalyticsMock).not.toHaveBeenCalled();
    expect(logEventMock).not.toHaveBeenCalled();
  });

  it("only calls isSupported()/getAnalytics() once across multiple trackEvent calls", async () => {
    vi.stubGlobal("window", {});
    isSupportedMock.mockResolvedValue(true);
    const analyticsInstance = { app: "analytics" };
    getAnalyticsMock.mockReturnValue(analyticsInstance);
    const { trackEvent } = await import("@/lib/analytics/track-event");

    trackEvent("login");
    trackEvent("dashboard_viewed");
    trackEvent("profile_viewed");
    await flushMicrotasks();

    expect(isSupportedMock).toHaveBeenCalledTimes(1);
    expect(getAnalyticsMock).toHaveBeenCalledTimes(1);
  });

  it("calls logEvent with the analytics instance and event name for each call when supported", async () => {
    vi.stubGlobal("window", {});
    isSupportedMock.mockResolvedValue(true);
    const analyticsInstance = { app: "analytics" };
    getAnalyticsMock.mockReturnValue(analyticsInstance);
    const { trackEvent } = await import("@/lib/analytics/track-event");

    trackEvent("login");
    trackEvent("prediction_created");
    await flushMicrotasks();

    expect(logEventMock).toHaveBeenCalledTimes(2);
    expect(logEventMock).toHaveBeenNthCalledWith(1, analyticsInstance, "login");
    expect(logEventMock).toHaveBeenNthCalledWith(
      2,
      analyticsInstance,
      "prediction_created",
    );
  });

  it("catches logEvent throwing, logs via console.error, and never throws to the caller", async () => {
    vi.stubGlobal("window", {});
    isSupportedMock.mockResolvedValue(true);
    getAnalyticsMock.mockReturnValue({});
    logEventMock.mockImplementation(() => {
      throw new Error("blocked by adblocker");
    });
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const { trackEvent } = await import("@/lib/analytics/track-event");

    expect(() => trackEvent("login")).not.toThrow();
    await flushMicrotasks();

    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("catches isSupported() rejecting, logs via console.error, and never throws to the caller", async () => {
    vi.stubGlobal("window", {});
    isSupportedMock.mockRejectedValue(new Error("init failed"));
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const { trackEvent } = await import("@/lib/analytics/track-event");

    expect(() => trackEvent("login")).not.toThrow();
    await flushMicrotasks();

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(logEventMock).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
