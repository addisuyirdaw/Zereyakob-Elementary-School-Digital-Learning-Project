"use client";

import { ArrowUpRight, Handshake, Sparkles } from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";

const CLUB_URL = "https://dbu-ss.vercel.app";

export function ClubBanner() {
  const { t, lang } = useLang();

  return (
    <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-royal-950 via-royal-900 to-royal-700 text-white shadow-2xl shadow-royal-900/30">
        <div
          className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-royal-400/20 blur-3xl"
          aria-hidden
        />
        <div
          className="absolute -bottom-32 left-10 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl"
          aria-hidden
        />
        <div className="relative grid gap-8 p-8 sm:p-12 lg:grid-cols-[1.5fr_1fr] lg:items-center lg:gap-12">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-royal-100 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" aria-hidden />
              {t("club.banner.eyebrow")}
            </span>
            <h2 className="mt-5 max-w-xl text-2xl font-extrabold leading-tight tracking-tight text-balance sm:text-3xl lg:text-4xl">
              {t("club.banner.title")}
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-royal-100/90 sm:text-base">
              {t("club.banner.body")}
            </p>
            <div className="mt-7 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <a
                href={CLUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-amber-400 px-7 text-base font-bold text-royal-950 shadow-xl shadow-amber-400/30 transition hover:bg-amber-300"
              >
                <Handshake className="h-5 w-5" aria-hidden />
                {t("club.banner.cta")}
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </a>
            </div>
            <p className="mt-4 text-xs font-medium text-royal-200/70">
              {t("club.banner.note")}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {[
              { value: "11", label: lang === "en" ? "university clubs" : "የዩኒቨርሲቲ ክለቦች" },
              { value: "DBU", label: lang === "en" ? "Debre Berhan University" : "ደብረ ብርሃን ዩኒቨርሲቲ" },
              { value: "100%", label: lang === "en" ? "student-led" : "በተማሪዎች የሚመራ" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur transition hover:bg-white/15"
              >
                <p className="text-2xl font-extrabold text-amber-300">{stat.value}</p>
                <p className="mt-1 text-xs font-semibold text-royal-100/90">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}