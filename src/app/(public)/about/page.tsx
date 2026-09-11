"use client";

import Link from "next/link";
import {
  ArrowRight,
  GraduationCap,
  HeartHandshake,
  Target,
  Users,
  Wrench,
} from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { PublicTeam } from "@/components/public-team";
import { PublicContributors } from "@/components/public-contributors";

export default function AboutPage() {
  const { t, lang } = useLang();

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
          {t("about.title")}
        </h1>
        <p className="mt-4 leading-relaxed text-slate-600">{t("landing.subtitle")}</p>
      </div>

      {/* Mission */}
      <div className="mt-14 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/60 bg-white/90 p-8 shadow-xl shadow-slate-900/5">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-royal-50 text-royal-700">
            <Target className="h-6 w-6" aria-hidden />
          </span>
          <h2 className="mt-5 text-xl font-extrabold text-slate-900">
            {t("about.mission.title")}
          </h2>
          <p className="mt-3 leading-relaxed text-slate-600">
            {t("about.mission.desc")}
          </p>
        </div>
        <div className="rounded-2xl border border-royal-200/60 bg-gradient-to-br from-royal-800 to-royal-950 p-8 text-white shadow-xl">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-white">
            <GraduationCap className="h-6 w-6" aria-hidden />
          </span>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-widest text-royal-200">
            {t("brand.partner.role")}
          </p>
          <h2 className="mt-1 text-xl font-extrabold">{t("brand.partner")}</h2>
          <p className="mt-3 leading-relaxed text-slate-200">
            {t("landing.partnership.desc")}
          </p>
          <a
            href="https://www.dbu.edu.et"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-royal-200 hover:text-white"
          >
            dbu.edu.et <ArrowRight className="h-4 w-4" aria-hidden />
          </a>
        </div>
      </div>

      {/* Core Team — dynamic from the public directory */}
      <div className="mt-20">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-royal-700" aria-hidden />
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
            {t("about.team.title")}
          </h2>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          {t("about.team.subtitle")}
        </p>
        <div className="mt-8">
          <PublicTeam />
        </div>
      </div>

      {/* Project Contributors & Interns */}
      <div className="mt-20">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-6 w-6 text-royal-700" aria-hidden />
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
            {lang === "en" ? "Project Contributors & Interns" : "የፕሮጀክት አስተዋፅዖ አበርካቾች እና ሰልጣኞች"}
          </h2>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          {lang === "en"
            ? "Instructors, project leads, former interns, and new team members driving digital learning forward."
            : "የዲጂታል ትምህርት ፈጠራን የሚያንቀሳቅሱ አስተማሪዎች፣ የፕሮጀክት መሪዎች፣ የቀድሞ ሰልጣኞች እና የቡድን አባላት።"}
        </p>
        <div className="mt-8">
          <PublicContributors />
        </div>
      </div>

      {/* Teachers */}
      <div className="mt-16 flex flex-col items-start gap-6 rounded-2xl border border-slate-200/60 bg-white/90 p-8 shadow-xl shadow-slate-900/5 sm:flex-row sm:items-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-royal-700 text-white shadow-glow">
          <Wrench className="h-6 w-6" aria-hidden />
        </span>
        <div className="flex-1">
          <h2 className="text-lg font-extrabold text-slate-900">{t("about.teachers")}</h2>
          <p className="mt-1 text-sm text-slate-600">{t("about.teachers.desc")}</p>
        </div>
        <Link
          href="/#contact"
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-royal-700 px-5 text-sm font-semibold text-white shadow-lg shadow-royal-700/25 transition hover:bg-royal-600"
        >
          <HeartHandshake className="h-4 w-4" aria-hidden />
          {t("nav.contact")}
        </Link>
      </div>
    </div>
  );
}