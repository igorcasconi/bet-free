// Server-only Supabase client using the service role key — bypasses RLS.
// Only `features/sports-sync/services/*` may import this file. Never import
// from client-side code or other features.
import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

export const supabaseAdmin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
);
