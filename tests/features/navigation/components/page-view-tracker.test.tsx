import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePathname } from "next/navigation";

import { trackEvent } from "@/lib/analytics/track-event";
import { PageViewTracker } from "@/features/navigation/components/page-view-tracker";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

vi.mock("@/lib/analytics/track-event", () => ({
  trackEvent: vi.fn(),
}));

const mockUsePathname = vi.mocked(usePathname);
const mockTrackEvent = vi.mocked(trackEvent);

afterEach(() => {
  vi.clearAllMocks();
});

describe("PageViewTracker", () => {
  it("tracks dashboard_viewed on /home", () => {
    mockUsePathname.mockReturnValue("/home");
    render(<PageViewTracker />);

    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledWith("dashboard_viewed");
  });

  it("tracks profile_viewed on /profile", () => {
    mockUsePathname.mockReturnValue("/profile");
    render(<PageViewTracker />);

    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledWith("profile_viewed");
  });

  it("tracks matches_viewed on /matches", () => {
    mockUsePathname.mockReturnValue("/matches");
    render(<PageViewTracker />);

    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledWith("matches_viewed");
  });

  it("does not track anything on an unmapped route", () => {
    mockUsePathname.mockReturnValue("/rankings");
    render(<PageViewTracker />);

    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it("does not fire a second time when re-rendered with the same pathname", () => {
    mockUsePathname.mockReturnValue("/home");
    const { rerender } = render(<PageViewTracker />);
    rerender(<PageViewTracker />);

    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
  });

  it("renders nothing", () => {
    mockUsePathname.mockReturnValue("/home");
    const { container } = render(<PageViewTracker />);

    expect(container.firstChild).toBeNull();
  });
});
