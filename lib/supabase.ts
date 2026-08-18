import { createClient } from "@supabase/supabase-js";

export const RESULTS_BUCKET = "generated-images";

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);
