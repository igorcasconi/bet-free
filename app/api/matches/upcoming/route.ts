import { NextResponse } from "next/server";

import { getUpcomingMatchesPage } from "@/features/matches";
import { getCurrentFirebaseUid } from "@/lib/auth/get-current-user";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const ISO_DATE_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseCursor(
  matchDateParam: string | null,
  idParam: string | null,
): { matchDate: string; id: string } | null {
  if (!matchDateParam || !idParam) return null;
  if (!ISO_DATE_REGEX.test(matchDateParam) || !UUID_REGEX.test(idParam)) {
    return null;
  }
  return { matchDate: matchDateParam, id: idParam };
}

function parseLimit(limitParam: string | null): number {
  const parsed = Number(limitParam);
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cursor = parseCursor(
    searchParams.get("cursorMatchDate"),
    searchParams.get("cursorId"),
  );
  const limit = parseLimit(searchParams.get("limit"));

  try {
    const firebaseUid = await getCurrentFirebaseUid();
    const page = await getUpcomingMatchesPage({ firebaseUid, cursor, limit });
    return NextResponse.json(page, { status: 200 });
  } catch (error) {
    console.error("[GET /api/matches/upcoming]", error);
    return NextResponse.json(
      { error: "Failed to fetch upcoming matches" },
      { status: 500 },
    );
  }
}
