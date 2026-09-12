"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { initials } from "@/lib/utils";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { ExpandableText } from "@/components/expandable-bio";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export function PublicContributors() {
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
        .eq("section", "contributor")
        .order("display_order", { ascending: true });

      if (error) {
        const fallback = await supabase
          .from("profiles")
          .select("*")
          .eq("is_public", true)
          .gte("display_order", 10)
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
            className="group flex flex-col justify-between rounded-2xl border border-slate-200/60 bg-white/90 p-6 shadow-xl shadow-slate-900/5 transition hover:-translate-y-1 hover:border-royal-300 hover:shadow-2xl hover:shadow-royal-700/10"
          >
            <div>
              <div className="flex items-start gap-4">
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
                <div className="min-w-0 flex-1">
                  <h3 className="font-extrabold text-slate-900 leading-snug break-words">
                    {fullName}
                  </h3>
                  {profession ? (
                    <div className="mt-1">
                      <ExpandableText
                        text={profession}
                        lines={2}
                        className="text-xs sm:text-sm font-semibold text-royal-700 leading-snug"
                        readMoreLabel={lang === "en" ? "Read more" : "ተጨማሪ"}
                        showLessLabel={lang === "en" ? "Show less" : "አሳጥር"}
                      />
                    </div>
                  ) : (
                    <span className="mt-1 inline-block rounded-md border border-royal-200 bg-royal-50 px-2 py-0.5 text-[11px] font-bold text-royal-700">
                      {lang === "en" ? "Contributor" : "አስተዋፅዖ አበርካች"}
                    </span>
                  )}
                </div>
              </div>

              {member.bio && (
                <div className="mt-3 border-t border-slate-100/80 pt-2.5">
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
