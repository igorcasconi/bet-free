import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const syncSessionMock = vi.fn();
const pushMock = vi.fn();
const trackEventMock = vi.fn();
const toastErrorMock = vi.fn();
const signInWithGoogleRedirectMock = vi.fn();
const resolveGoogleRedirectMock = vi.fn();

vi.mock("@/features/auth/actions/session-actions", () => ({
  syncSession: syncSessionMock,
}));

vi.mock("@/features/auth/services/auth-service", () => ({
  signInWithGoogleRedirect: signInWithGoogleRedirectMock,
  resolveGoogleRedirect: resolveGoogleRedirectMock,
  mapFirebaseError: () => "Algo deu errado, tente novamente",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/analytics/track-event", () => ({
  trackEvent: trackEventMock,
}));

vi.mock("sonner", () => ({
  toast: { error: toastErrorMock },
}));

const { useLoginWithGoogle } =
  await import("@/features/auth/hooks/use-login-with-google");

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return wrapper;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("useLoginWithGoogle", () => {
  it("tracks login and redirects to the default route when the redirect resolves", async () => {
    const credential = {
      user: { getIdToken: vi.fn().mockResolvedValue("id-token") },
    };
    resolveGoogleRedirectMock.mockResolvedValue(credential);
    syncSessionMock.mockResolvedValue(undefined);
    const wrapper = createWrapper();

    const { result } = renderHook(() => useLoginWithGoogle(), { wrapper });

    await act(async () => {
      await result.current.resolveRedirect();
    });

    expect(trackEventMock).toHaveBeenCalledTimes(1);
    expect(trackEventMock).toHaveBeenCalledWith("login");
    expect(pushMock).toHaveBeenCalledWith("/home");
  });

  it("redirects to the custom redirectTo when the redirect resolves", async () => {
    const credential = {
      user: { getIdToken: vi.fn().mockResolvedValue("id-token") },
    };
    resolveGoogleRedirectMock.mockResolvedValue(credential);
    syncSessionMock.mockResolvedValue(undefined);
    const wrapper = createWrapper();

    const { result } = renderHook(() => useLoginWithGoogle("/matches"), {
      wrapper,
    });

    await act(async () => {
      await result.current.resolveRedirect();
    });

    expect(trackEventMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith("/matches");
  });

  it("does not track login when there is no redirect result", async () => {
    resolveGoogleRedirectMock.mockResolvedValue(null);
    const wrapper = createWrapper();

    const { result } = renderHook(() => useLoginWithGoogle(), { wrapper });

    await act(async () => {
      await result.current.resolveRedirect();
    });

    expect(trackEventMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
    expect(syncSessionMock).not.toHaveBeenCalled();
  });

  it("does not track login or redirect when resolving the redirect fails", async () => {
    resolveGoogleRedirectMock.mockRejectedValue({
      code: "auth/too-many-requests",
    });
    const wrapper = createWrapper();

    const { result } = renderHook(() => useLoginWithGoogle(), { wrapper });

    await act(async () => {
      await result.current.resolveRedirect();
    });

    expect(trackEventMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
    expect(toastErrorMock).toHaveBeenCalledTimes(1);
  });
});
