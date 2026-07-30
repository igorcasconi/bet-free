import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MatchCardData } from "@/features/matches/types";

const mutateAsyncMock = vi.fn();

vi.mock("@/features/matches/hooks/use-submit-prediction", () => ({
  useSubmitPrediction: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
}));

const { PredictDialog } =
  await import("@/features/matches/components/predict-dialog");

const baseMatch: MatchCardData = {
  id: "match-1",
  competitionId: "comp-1",
  competitionName: "Brasileirão",
  matchDate: "2026-07-26T18:30:00.000Z",
  status: "scheduled",
  homeTeamName: "Flamengo",
  homeTeamShort: "FLA",
  awayTeamName: "Palmeiras",
  awayTeamShort: "PAL",
  prediction: null,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PredictDialog", () => {
  it("shows an inline error and does not call the mutation for invalid input", async () => {
    render(<PredictDialog match={baseMatch} open onOpenChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("FLA"), {
      target: { value: "-1" },
    });
    fireEvent.change(screen.getByLabelText("PAL"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(
        screen.getByText("Deve ser um inteiro não negativo"),
      ).toBeInTheDocument();
    });
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  it("shows a required error and does not call the mutation for empty input", async () => {
    render(<PredictDialog match={baseMatch} open onOpenChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("FLA"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("PAL"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(screen.getByText("Obrigatório")).toBeInTheDocument();
    });
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  it("shows an inline error and keeps the dialog open when the mutation rejects", async () => {
    mutateAsyncMock.mockRejectedValue(new Error("network down"));
    const onOpenChange = vi.fn();

    render(
      <PredictDialog match={baseMatch} open onOpenChange={onOpenChange} />,
    );

    fireEvent.change(screen.getByLabelText("FLA"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("PAL"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(
        screen.getByText("Não foi possível salvar o palpite."),
      ).toBeInTheDocument();
    });
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("calls the mutation and closes the dialog on a valid, successful submit", async () => {
    mutateAsyncMock.mockResolvedValue({ ok: true });
    const onOpenChange = vi.fn();

    render(
      <PredictDialog match={baseMatch} open onOpenChange={onOpenChange} />,
    );

    fireEvent.change(screen.getByLabelText("FLA"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("PAL"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        matchId: "match-1",
        predictedHomeScore: 2,
        predictedAwayScore: 1,
      });
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("keeps the dialog open and shows the error on a failed submit", async () => {
    mutateAsyncMock.mockResolvedValue({
      ok: false,
      error: "match already started",
    });
    const onOpenChange = vi.fn();

    render(
      <PredictDialog match={baseMatch} open onOpenChange={onOpenChange} />,
    );

    fireEvent.change(screen.getByLabelText("FLA"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("PAL"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(screen.getByText("match already started")).toBeInTheDocument();
    });
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("pre-fills the form when editing an existing prediction", () => {
    render(
      <PredictDialog
        match={{
          ...baseMatch,
          prediction: {
            id: "pred-1",
            predictedHomeScore: 3,
            predictedAwayScore: 2,
          },
        }}
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("FLA")).toHaveValue(3);
    expect(screen.getByLabelText("PAL")).toHaveValue(2);
  });
});
