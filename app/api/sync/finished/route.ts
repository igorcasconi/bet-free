import { NextResponse } from "next/server";

import {
  matchSyncService,
  SyncAlreadyRunningError,
} from "@/features/sports-sync";
import { env } from "@/lib/env";
import { isValidSyncSecret } from "@/lib/sync-auth";

export async function POST(request: Request) {
  if (
    !isValidSyncSecret(request.headers.get("x-sync-secret"), env.SYNC_SECRET)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await matchSyncService.updateFinishedMatches();
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof SyncAlreadyRunningError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
