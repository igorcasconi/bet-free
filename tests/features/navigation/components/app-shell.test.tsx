import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { usePathname } from "next/navigation";

import { AppShell } from "@/features/navigation/components/app-shell";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

const mockUsePathname = vi.mocked(usePathname);

describe("AppShell", () => {
  it("renders Sidebar, BottomNav, and children together", () => {
    mockUsePathname.mockReturnValue("/home");
    render(
      <AppShell>
        <div data-testid="page-content">Dashboard content</div>
      </AppShell>,
    );

    expect(screen.getByTestId("page-content")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /home/i }).length).toBe(2);
  });
});
