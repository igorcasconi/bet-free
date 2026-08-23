import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MatchCard } from "@/features/dashboard/components/match-card";
import type { MatchCardData } from "@/features/matches/types";

const baseMatch: MatchCardData = {
  id: "match-1",
  competitionId: "comp-1",
  competitionName: "Premier League",
  matchDate: "2026-07-26T15:30:00.000Z",
  status: "scheduled",
  homeTeamName: "Arsenal",
  homeTeamShort: "ARS",
  awayTeamName: "Chelsea",
  awayTeamShort: "CHE",
  prediction: null,
};

afterEach(() => {
  cleanup();
});

describe("MatchCard", () => {
  it("renders competition, time, and both team names", () => {
    render(<MatchCard match={baseMatch} onPredict={vi.fn()} />);

    expect(screen.getByText("Premier League")).toBeInTheDocument();
    expect(screen.getByText(/\d{1,2}:\d{2}/)).toBeInTheDocument();
    expect(screen.getByText("Arsenal")).toBeInTheDocument();
    expect(screen.getByText("Chelsea")).toBeInTheDocument();
    expect(screen.getByText("ARS")).toBeInTheDocument();
    expect(screen.getByText("CHE")).toBeInTheDocument();
  });

  it("shows 'Sem palpite' and an enabled Palpitar CTA when there is no prediction", () => {
    render(<MatchCard match={baseMatch} onPredict={vi.fn()} />);

    expect(screen.getByText("Sem palpite")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Palpitar" }),
    ).not.toBeDisabled();
  });

  it("shows 'Palpite feito' and an enabled Editar palpite CTA when a prediction exists", () => {
    const predicted: MatchCardData = {
      ...baseMatch,
      prediction: { id: "pred-1", predictedHomeScore: 2, predictedAwayScore: 1 },
    };

    render(<MatchCard match={predicted} onPredict={vi.fn()} />);

    expect(screen.getByText("Palpite feito")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Editar palpite" }),
    ).not.toBeDisabled();
  });

  it("disables the CTA when the match is no longer scheduled", () => {
    const locked: MatchCardData = { ...baseMatch, status: "live" };

    render(<MatchCard match={locked} onPredict={vi.fn()} />);

    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("does not show a prediction badge when the match is locked", () => {
    const locked: MatchCardData = { ...baseMatch, status: "finished" };

    render(<MatchCard match={locked} onPredict={vi.fn()} />);

    expect(screen.queryByText("Sem palpite")).not.toBeInTheDocument();
    expect(screen.queryByText("Palpite feito")).not.toBeInTheDocument();
  });

  it("calls onPredict with the match when the CTA is clicked", () => {
    const onPredict = vi.fn();
    render(<MatchCard match={baseMatch} onPredict={onPredict} />);

    fireEvent.click(screen.getByRole("button", { name: "Palpitar" }));

    expect(onPredict).toHaveBeenCalledWith(baseMatch);
  });
});
