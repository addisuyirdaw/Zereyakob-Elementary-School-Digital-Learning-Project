"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { initials } from "@/lib/utils";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { ExpandableText } from "@/components/expandable-bio";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export function PublicTeam() {
  const { lang } = useLang();
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
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("is_public", true)
        .eq("section", "core")
        .order("display_order", { ascending: true });

      if (error) {
        const fallback = await supabase
          .from("profiles")
          .select("*")
          .eq("is_public", true)
          .lt("display_order", 10)
          .order("display_order", { ascending: true });
        if (!cancelled) {
          setMembers(fallback.data ?? []);
          setLoaded(true);
        }
        return;
      }

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
            className="group flex flex-col justify-between rounded-3xl border border-slate-100 bg-white p-7 shadow-lg shadow-slate-900/5 transition-all duration-300 hover:-translate-y-2 hover:border-royal-200 hover:shadow-2xl hover:shadow-royal-900/10"
          >
            <div>
              <div className="flex items-center gap-5">
                {member.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={member.avatar_url}
                    alt={fullName}
                    className="h-16 w-16 shrink-0 rounded-full object-cover ring-4 ring-royal-50 transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-royal-600 to-royal-400 text-lg font-black text-white shadow-md ring-4 ring-royal-50 transition-transform duration-300 group-hover:scale-105">
                    {initials(member.first_name, member.last_name)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-extrabold text-slate-900 leading-snug break-words group-hover:text-royal-700 transition-colors">
                    {fullName}
                  </h3>
                  {profession && (
                    <div className="mt-1">
                      <ExpandableText
                        text={profession}
                        lines={2}
                        className="text-sm font-semibold text-royal-600 leading-snug"
                        readMoreLabel={lang === "en" ? "Read more" : "ተጨማሪ"}
                        showLessLabel={lang === "en" ? "Show less" : "አሳጥር"}
                      />
                    </div>
                  )}
                </div>
              </div>

              {member.bio && (
                <div className="mt-5 pt-4">
                  <ExpandableText
                    text={member.bio}
                    lines={3}
                    className="text-sm leading-relaxed text-slate-500"
                    readMoreLabel={lang === "en" ? "Read more" : "ተጨማሪ አንብብ"}
                    showLessLabel={lang === "en" ? "Show less" : "አሳጥር"}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}