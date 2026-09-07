import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const RESULTS_BUCKET = "generated-images";
export const GENERATIONS_TABLE = "generations";
export const SECTION_EXAMPLES_TABLE = "section_examples";

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

// Best-rated (score >= 8) past descriptions for one card category, used as
// few-shot style/detail-level examples when analyzing a new image for that
// same category. Never throws — a lookup failure just means no examples.
export async function fetchGoodExamples(category: string, limit = 2): Promise<string[]> {
  const { data, error } = await supabaseAdmin()
    .from(SECTION_EXAMPLES_TABLE)
    .select("text")
    .eq("category", category)
    .order("score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((row) => row.text as string);
}
