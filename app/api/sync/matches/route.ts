import { NextResponse } from "next/server";

import { syncMatches } from "@/features/sports-sync";
import { env } from "@/lib/env";
import { isValidSyncSecret } from "@/lib/sync-auth";

export async function POST(request: Request) {
  if (
    !isValidSyncSecret(request.headers.get("x-sync-secret"), env.SYNC_SECRET)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncMatches();
    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
