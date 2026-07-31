import { SportsProviderError } from "@/lib/sports-provider/types";

export async function fetchJson(
  url: string,
  headers?: HeadersInit,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, headers ? { headers } : undefined);
  } catch (cause) {
    throw new SportsProviderError("Failed to reach sports provider API", cause);
  }
  if (!response.ok) {
    throw new SportsProviderError(
      `Sports provider API responded with status ${response.status}`,
    );
  }
  try {
    return await response.json();
  } catch (cause) {
    throw new SportsProviderError(
      "Failed to parse sports provider API response as JSON",
      cause,
    );
  }
}

export function createThrottledFetchJson(
  minIntervalMs: number,
): (url: string, headers?: HeadersInit) => Promise<unknown> {
  let lastCallAt: number | null = null;

  return async (url: string, headers?: HeadersInit): Promise<unknown> => {
    if (lastCallAt !== null) {
      const elapsed = Date.now() - lastCallAt;
      const remaining = minIntervalMs - elapsed;
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
    }
    lastCallAt = Date.now();
    return fetchJson(url, headers);
  };
}
