import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const syncSessionMock = vi.fn();
const pushMock = vi.fn();
const trackEventMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock("@/features/auth/actions/session-actions", () => ({
  syncSession: syncSessionMock,
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

const { useEmailPasswordMutation } =
  await import("@/features/auth/hooks/use-email-password-mutation");

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

describe("useEmailPasswordMutation", () => {
  it("tracks login and redirects to the default route on success", async () => {
    const credential = {
      user: { getIdToken: vi.fn().mockResolvedValue("id-token") },
    };
    const authFn = vi.fn().mockResolvedValue(credential);
    syncSessionMock.mockResolvedValue(undefined);
    const wrapper = createWrapper();

    const { result } = renderHook(() => useEmailPasswordMutation(authFn), {
      wrapper,
    });

    act(() => {
      result.current.mutate({ email: "a@b.com", password: "secret" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(trackEventMock).toHaveBeenCalledTimes(1);
    expect(trackEventMock).toHaveBeenCalledWith("login");
    expect(pushMock).toHaveBeenCalledWith("/home");
  });

  it("redirects to the custom redirectTo on success", async () => {
    const credential = {
      user: { getIdToken: vi.fn().mockResolvedValue("id-token") },
    };
    const authFn = vi.fn().mockResolvedValue(credential);
    syncSessionMock.mockResolvedValue(undefined);
    const wrapper = createWrapper();

    const { result } = renderHook(
      () => useEmailPasswordMutation(authFn, "/matches"),
      { wrapper },
    );

    act(() => {
      result.current.mutate({ email: "a@b.com", password: "secret" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(trackEventMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith("/matches");
  });

  it("does not track login or redirect when authentication fails", async () => {
    const authFn = vi.fn().mockRejectedValue({ code: "auth/wrong-password" });
    const wrapper = createWrapper();

    const { result } = renderHook(() => useEmailPasswordMutation(authFn), {
      wrapper,
    });

    act(() => {
      result.current.mutate({ email: "a@b.com", password: "secret" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(trackEventMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
    expect(toastErrorMock).toHaveBeenCalledTimes(1);
  });
});
