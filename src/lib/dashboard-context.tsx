"use client";

import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { createClient } from "@/lib/supabase/client";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

type DashboardContextValue = {
  user: User | null;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  isStaff: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
};

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({
  user,
  profile,
  children,
}: {
  user: User | null;
  profile: Profile | null;
  children: ReactNode;
}) {
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(profile);
  const router = useRouter();

  const refreshProfile = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user?.id ?? "")
      .maybeSingle();
    if (!error && data) setCurrentProfile(data);
  }, [user?.id]);

  const signOut = useCallback(async () => {
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }, [router]);

  const role = currentProfile?.role ?? "student";
  const isStaff =
    role === "super_admin" || role === "admin" || role === "teacher" || role === "staff";
  const isAdmin = role === "super_admin" || role === "admin";
  const isSuperAdmin = role === "super_admin";

  return (
    <DashboardContext.Provider
      value={{
        user,
        profile: currentProfile,
        refreshProfile,
        signOut,
        isStaff,
        isAdmin,
        isSuperAdmin,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}