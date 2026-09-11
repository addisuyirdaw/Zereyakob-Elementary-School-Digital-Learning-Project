"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { initials } from "@/lib/utils";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export function PublicTeam() {
  const [members, setMembers] = useState<Profile[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      if (!supabase) {
        if (!cancelled) setLoaded(true);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("is_public", true)
        .gte("display_order", 1)
        .lte("display_order", 6)
        .order("display_order", { ascending: true });
      if (!cancelled) {
        setMembers(data ?? []);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded || members.length === 0) return null;

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {members.map((member) => {
        const fullName =
          [member.first_name, member.last_name].filter(Boolean).join(" ") ||
          member.email;
        const profession = member.profession || member.title;
        return (
          <div
            key={member.id}
            className="group flex flex-col rounded-2xl border border-slate-200/60 bg-white/90 p-6 shadow-xl shadow-slate-900/5 transition hover:-translate-y-1 hover:border-royal-300 hover:shadow-2xl hover:shadow-royal-700/10"
          >
            <div className="flex items-center gap-4">
              {member.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={member.avatar_url}
                  alt={fullName}
                  className="h-16 w-16 shrink-0 rounded-2xl object-cover ring-2 ring-royal-100"
                />
              ) : (
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-royal-600 to-royal-800 text-lg font-extrabold text-white shadow-glow">
                  {initials(member.first_name, member.last_name)}
                </span>
              )}
              <div className="min-w-0">
                <h3 className="truncate font-extrabold text-slate-900">{fullName}</h3>
                {profession && (
                  <p className="mt-1 truncate text-sm font-bold text-royal-700">
                    {profession}
                  </p>
                )}
              </div>
            </div>

            {member.bio && (
              <p className="mt-4 text-sm leading-relaxed text-slate-500 line-clamp-3">
                {member.bio}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}