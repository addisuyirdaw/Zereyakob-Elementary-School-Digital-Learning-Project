"use client";

import Link from "next/link";
import { ArrowUpRight, GraduationCap, Handshake, HeartHandshake, Mail, MapPin, Phone } from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { LogoMark } from "./logo";

export function Footer() {
  const { t, lang } = useLang();

  return (
    <footer className="border-t border-slate-800 bg-slate-950 text-slate-300">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <LogoMark className="h-10 w-10 rounded-xl" />
              <div>
                <p className="text-sm font-extrabold text-white">{t("brand.name")}</p>
                <p className="text-[11px] text-slate-400">{t("brand.tagline")}</p>
              </div>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">
              {lang === "am"
                ? "በዘረያቆብ አንደኛ ደረጃ ትምህርት ቤት እያንዳንዱ ልጅ በደስታ፣ በጥራት እና በዘመናዊ ቴክኖሎጂ እየተማረ ለወደፊቱ ዓለም ይዘጋጃል።"
                : "At Zereyakob Elementary every child learns with joy, quality and modern technology — prepared for the world ahead."}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              {t("nav.home")}
            </p>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link href="/" className="transition hover:text-white">
                  {t("nav.home")}
                </Link>
              </li>
              <li>
                <Link href="/about" className="transition hover:text-white">
                  {t("nav.about")}
                </Link>
              </li>
              <li>
                <Link href="/#contact" className="transition hover:text-white">
                  {t("nav.contact")}
                </Link>
              </li>
              <li>
                <a
                  href="https://dbu-ss.vercel.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-bold text-royal-300 transition hover:text-royal-200"
                >
                  <GraduationCap className="h-4 w-4" aria-hidden />
                  {t("nav.club")}
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              {t("nav.contact")}
            </p>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0 text-royal-400" aria-hidden />
                {lang === "am" ? "ዘረያቆብ፣ ኢትዮጵያ" : "Zereyakob, Ethiopia"}
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-royal-400" aria-hidden />
                contact@zereyakob.edu.et
              </li>
              <li className="flex items-center gap-2">
                <HeartHandshake className="h-4 w-4 shrink-0 text-royal-400" aria-hidden />
                {lang === "am" ? "አጋርነትን እንቀበላለን" : "We welcome partnerships"}
              </li>
            </ul>
          </div>
        </div>

        {/* Debre Berhan University partnership badge */}
        <a
          href="https://www.dbu.edu.et"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-12 flex items-center justify-between gap-4 rounded-2xl border border-royal-800/60 bg-gradient-to-r from-royal-900/40 via-royal-900/20 to-transparent p-5 transition hover:border-royal-500 hover:from-royal-800/50"
        >
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-royal-700 text-white shadow-glow">
              <GraduationCap className="h-6 w-6" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-extrabold text-white">{t("brand.partner")}</p>
              <p className="text-xs text-slate-400">
                {lang === "am"
                  ? "ኦፊሴላዊ የትምህርት አጋራችን"
                  : "Our official institutional partner"}
              </p>
            </div>
          </div>
          <Phone className="h-5 w-5 text-royal-400" aria-hidden />
        </a>

        {/* DBU Club Connect — student-led community initiative */}
        <a
          href="https://dbu-ss.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-5 transition hover:border-amber-400/60 hover:from-amber-500/15"
        >
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-royal-950">
              <Handshake className="h-6 w-6" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-extrabold text-white">{t("nav.club")}</p>
              <p className="text-xs text-slate-400">
                {lang === "am"
                  ? "11 የዩኒቨርሲቲ ክለቦች ህጻናትን እና ወላጆችን ለማሳደግ ተባብረዋል"
                  : "11 university clubs joining hands to uplift children and parents"}
              </p>
            </div>
          </div>
          <ArrowUpRight className="h-5 w-5 text-amber-300" aria-hidden />
        </a>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-slate-800 pt-6 text-xs text-slate-500 sm:flex-row">
          <p>© {new Date().getFullYear()} Zereyakob Elementary School</p>
          <p>
            {lang === "am"
              ? "በደብረ ብርሃን ዩኒቨርሲቲ ተባብሮ የተገነባ"
              : "Built in partnership with Debre Berhan University"}
          </p>
        </div>
      </div>
    </footer>
  );
}