import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The `@/features/dashboard` barrel re-exports `get-dashboard-data`, which
// instantiates a server-only Supabase client at module scope. Stub it so
// importing the barrel for `StatCard`/`XpProgressCard` doesn't touch Supabase in tests.
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: {} }));

import { GamificationSection } from "@/features/landing/components/gamification-section";

afterEach(() => {
  cleanup();
});

describe("GamificationSection", () => {
  it("renders XpProgressCard with mocked level/xp data", () => {
    render(<GamificationSection />);

    expect(screen.getByText("320 / 500")).toBeInTheDocument();
  });

  it("renders StatCards with mocked streak and accuracy values", () => {
    render(<GamificationSection />);

    expect(screen.getByText("7 dias")).toBeInTheDocument();
    expect(screen.getByText("Sequência Atual")).toBeInTheDocument();
    expect(screen.getByText("68%")).toBeInTheDocument();
    expect(screen.getByText("Precisão")).toBeInTheDocument();
  });
});
