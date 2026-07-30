import { supabaseAdmin } from "@/lib/supabase/admin";

const UNIQUE_VIOLATION = "23505";
const STALE_AFTER_SECONDS = 10 * 60;

export type SyncType =
  | "competitions"
  | "teams"
  | "matches"
  | "live"
  | "finished"
  | "predictions"
  | "rankings";

export class SyncAlreadyRunningError extends Error {
  constructor(readonly type: SyncType) {
    super(`Sync already running for type "${type}"`);
    this.name = "SyncAlreadyRunningError";
  }
}

// Reap-then-insert fused into one round-trip via a Postgres function
// (see supabase/migrations/00000000000013_add_acquire_sync_lock_function.sql)
// instead of two separate statements from the app.
async function acquireLock(type: SyncType): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc("acquire_sync_lock", {
    p_type: type,
    p_stale_after_seconds: STALE_AFTER_SECONDS,
  });

  if (error) {
    if (error.code === UNIQUE_VIOLATION)
      throw new SyncAlreadyRunningError(type);
    throw error;
  }

  return data;
}

async function finishLock(
  lockId: string,
  status: "finished" | "failed",
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("sync_runs")
    .update({ status, finished_at: new Date().toISOString() })
    .eq("id", lockId);

  if (error) throw error;
}

export async function withSyncLock<T>(
  type: SyncType,
  fn: () => Promise<T>,
): Promise<T> {
  const lockId = await acquireLock(type);

  try {
    const result = await fn();
    await finishLock(lockId, "finished");
    return result;
  } catch (error) {
    await finishLock(lockId, "failed");
    throw error;
  }
}
