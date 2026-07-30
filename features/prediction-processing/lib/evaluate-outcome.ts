export type MatchOutcome = "home" | "draw" | "away";

export function matchOutcome(
  homeScore: number,
  awayScore: number,
): MatchOutcome {
  if (homeScore > awayScore) return "home";
  if (homeScore < awayScore) return "away";
  return "draw";
}

export function isWinningPrediction(
  predicted: { home: number; away: number },
  actual: { home: number; away: number },
): boolean {
  return (
    matchOutcome(predicted.home, predicted.away) ===
    matchOutcome(actual.home, actual.away)
  );
}
