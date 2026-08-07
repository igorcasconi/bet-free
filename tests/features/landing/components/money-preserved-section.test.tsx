import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The `@/features/dashboard` barrel re-exports `get-dashboard-data`, which
// instantiates a server-only Supabase client at module scope. Stub it so
// importing the barrel for `MoneyPreservedCard` doesn't touch Supabase in tests.
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: {} }));

import { MoneyPreservedSection } from "@/features/landing/components/money-preserved-section";
import { MOCK_LANDING_STATS } from "@/features/landing/constants/mock-stats";

afterEach(() => {
  cleanup();
});

// `getByText` normalizes the DOM's whitespace (collapsing the currency
// formatter's non-breaking space into a regular space) but not the query
// string, so the expected value must be pre-normalized to match.
const expectedAmount = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})
  .format(MOCK_LANDING_STATS.moneySaved)
  .replace(/\s/g, " ");

describe("MoneyPreservedSection", () => {
  it("renders the money preserved card with the mocked BRL amount", () => {
    render(<MoneyPreservedSection />);

    expect(screen.getByText(expectedAmount)).toBeInTheDocument();
  });

  it("renders the 'Money Preserved' badge", () => {
    render(<MoneyPreservedSection />);

    expect(screen.getByText("Dinheiro Poupado")).toBeInTheDocument();
  });
});
