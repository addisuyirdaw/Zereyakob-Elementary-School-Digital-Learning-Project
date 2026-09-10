"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function supabaseConfigured(): boolean {
  return Boolean(url && anonKey);
}

export function createClient(): SupabaseClient | null {
  if (client) return client;
  if (!supabaseConfigured()) return null;
  client = createBrowserClient(url, anonKey);
  return client;
}