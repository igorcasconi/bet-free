import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MatchCard } from "@/features/matches/components/match-card";
import type { MatchCardData } from "@/features/matches/types";

const baseMatch: MatchCardData = {
  id: "match-1",
  competitionId: "comp-1",
  competitionName: "Brasileirão",
  matchDate: "2026-07-26T18:30:00.000Z", // 15:30 in America/Sao_Paulo (UTC-3)
  status: "scheduled",
  homeTeamName: "Flamengo",
  homeTeamShort: "FLA",
  awayTeamName: "Palmeiras",
  awayTeamShort: "PAL",
  prediction: null,
};

afterEach(() => {
  cleanup();
});

describe("MatchCard", () => {
  it("renders competition, teams, and kickoff time in America/Sao_Paulo", () => {
    render(<MatchCard match={baseMatch} onPredict={vi.fn()} />);

    expect(screen.getByText("Brasileirão")).toBeInTheDocument();
    expect(screen.getByText("Flamengo")).toBeInTheDocument();
    expect(screen.getByText("Palmeiras")).toBeInTheDocument();
    expect(screen.getByText("15:30")).toBeInTheDocument();
  });

  it.each([
    ["scheduled", "Agendado"],
    ["live", "Ao vivo"],
    ["finished", "Encerrado"],
    ["postponed", "Adiado"],
    ["cancelled", "Cancelado"],
  ] as const)("renders the %s status badge as %s", (status, label) => {
    render(<MatchCard match={{ ...baseMatch, status }} onPredict={vi.fn()} />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("shows 'Sem palpite' and an enabled Predict CTA when there is no prediction", () => {
    render(<MatchCard match={baseMatch} onPredict={vi.fn()} />);

    expect(screen.getByText("Sem palpite")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Palpitar" })).toBeEnabled();
  });

  it("shows 'Palpite feito' and an enabled Editar palpite CTA when a prediction exists", () => {
    render(
      <MatchCard
        match={{
          ...baseMatch,
          prediction: {
            id: "pred-1",
            predictedHomeScore: 2,
            predictedAwayScore: 1,
          },
        }}
        onPredict={vi.fn()}
      />,
    );

    expect(screen.getByText("Palpite feito")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Editar palpite" }),
    ).toBeEnabled();
  });

  it("disables the CTA when the match is no longer scheduled", () => {
    render(
      <MatchCard
        match={{ ...baseMatch, status: "finished" }}
        onPredict={vi.fn()}
      />,
    );

    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("calls onPredict with the match when the CTA is clicked", () => {
    const onPredict = vi.fn();
    render(<MatchCard match={baseMatch} onPredict={onPredict} />);

    fireEvent.click(screen.getByRole("button", { name: "Palpitar" }));

    expect(onPredict).toHaveBeenCalledWith(baseMatch);
  });
});
