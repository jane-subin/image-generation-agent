import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const RESULTS_BUCKET = "generated-images";

// Lazily constructed so importing this module (e.g. Next.js collecting route
// config at build time) never fails just because env vars aren't loaded yet.
let _client: SupabaseClient | null = null;
export function supabaseAdmin(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );
  }
  return _client;
}
