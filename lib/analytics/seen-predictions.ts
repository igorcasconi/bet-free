const STORAGE_KEY = "analytics_seen_predictions";

function parseSeenIds(raw: string | null): string[] {
  if (!raw) return [];

  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export function markPredictionSeen(predictionId: string): boolean {
  try {
    const seen = new Set(
      parseSeenIds(window.localStorage.getItem(STORAGE_KEY)),
    );

    if (seen.has(predictionId)) return false;

    seen.add(predictionId);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen]));

    return true;
  } catch {
    return true;
  }
}
