"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Globe2 } from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type Partner = Database["public"]["Tables"]["partners"]["Row"];

const fallbackPartner: Partner = {
  id: "debre-berhan-university",
  name: "Debre Berhan University",
  slug: "debre-berhan-university",
  website: "https://www.dbu.edu.et",
  logo_url: "",
  description_en:
    "Research, technology and teacher training — ensuring every Zereyakob child learns on world-class tools.",
  description_am:
    "ምርምር፣ ቴክኖሎጂ እና የመምህራን ስልጠና — እያንዳንዱ የዘረያቆብ ልጅ በዓለም ደረጃ በታወቁ መሳሪያዎች መማሩን ማረጋገጥ።",
  sort_order: 0,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export function PartnersGrid() {
  const { t, lang } = useLang();
  const [partners, setPartners] = useState<Partner[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      if (!supabase) {
        if (!cancelled) setPartners([fallbackPartner]);
        return;
      }
      const { data } = await supabase
        .from("partners")
        .select("*")
        .eq("is_active", true)
        .order("sort_order")
        .order("name");
      if (!cancelled) setPartners((data ?? []).length ? data : [fallbackPartner]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!partners) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-2xl border border-slate-200/60 bg-slate-100/60"
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
          {t("partners.title")}
        </h2>
        <p className="mt-3 text-slate-600">{t("partners.subtitle")}</p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {partners.map((partner) => {
          const title = partner.name;
          const description =
            lang === "am" && partner.description_am
              ? partner.description_am
              : partner.description_en || partner.description_am;
          return (
            <div
              key={partner.id}
              className="flex flex-col rounded-2xl border border-slate-200/60 bg-white/90 p-6 shadow-xl shadow-slate-900/5 backdrop-blur-sm transition hover:-translate-y-1 hover:border-royal-300 hover:shadow-2xl hover:shadow-royal-700/10"
            >
              <div className="flex items-start gap-4">
                {partner.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={partner.logo_url}
                    alt={title}
                    className="h-12 w-12 rounded-xl object-cover ring-1 ring-slate-200"
                  />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-royal-600 to-royal-800 text-white shadow-glow">
                    <Globe2 className="h-5 w-5" aria-hidden />
                  </span>
                )}
                <div className="min-w-0">
                  <h3 className="text-base font-extrabold text-slate-900">
                    {title}
                  </h3>
                  {partner.website && (
                    <p className="truncate text-xs font-medium text-slate-400">
                      {partner.website.replace(/^https?:\/\//, "")}
                    </p>
                  )}
                </div>
              </div>
              {description && (
                <p className="mt-4 flex-1 text-sm leading-relaxed text-slate-500">
                  {description}
                </p>
              )}
              {partner.website && (
                <a
                  href={partner.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-royal-700 transition hover:text-royal-600"
                >
                  {t("partners.visit")}
                  <ArrowUpRight className="h-4 w-4" aria-hidden />
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}