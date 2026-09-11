import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardProvider } from "@/lib/dashboard-context";
import type { User } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ReactNode } from "react";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default async function MeLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  if (!supabase) {
    redirect("/signin?configured=0");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin");
  }

  let profile: Profile | null = null;
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  profile = data;

  const safeUser: User = {
    id: user.id,
    app_metadata: user.app_metadata ?? {},
    user_metadata: user.user_metadata ?? {},
    aud: user.aud,
    created_at: user.created_at,
    email: user.email ?? null,
    role: user.role ?? null,
    updated_at: user.updated_at,
  } as User;

  return <DashboardProvider user={safeUser} profile={profile}>{children}</DashboardProvider>;
}