import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

type AdminClient = SupabaseClient;

let cached: AdminClient | null = null;

/**
 * Server-only Supabase client with the service-role ("secret") key.
 * Bypasses RLS — used exclusively inside API route handlers after the caller
 * has been verified as a Super Admin. Requires SUPABASE_SERVICE_ROLE_KEY.
 */
export function createAdminClient(): AdminClient | null {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !serviceKey) return null;

  cached = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return cached;
}

export function adminConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}