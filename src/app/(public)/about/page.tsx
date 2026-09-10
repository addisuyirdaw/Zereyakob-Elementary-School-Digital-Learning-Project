"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building2,
  GraduationCap,
  HeartHandshake,
  Target,
  Users,
  Wrench,
  Microscope,
  BookOpenCheck,
  Cpu,
} from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";

export default function AboutPage() {
  const { t, lang } = useLang();

  const team = [
    {
      name: lang === "en" ? "School Founder" : "የትምህርት ቤት መስራች",
      title: t("about.team.member.admin"),
      icon: <Building2 className="h-5 w-5" aria-hidden />,
      initials: "SA",
    },
    {
      name: lang === "en" ? "Eng. Abiy" : "መሀንድስ አቢይ",
      title: t("about.team.member.engineer"),
      icon: <Cpu className="h-5 w-5" aria-hidden />,
      initials: "EA",
    },
    {
      name: lang === "en" ? "Dr. Demssie" : "ዶ/ር ደምሰው",
      title: t("about.team.member.researcher1"),
      icon: <Microscope className="h-5 w-5" aria-hidden />,
      initials: "DD",
    },
    {
      name: lang === "en" ? "Dr. Betel" : "ዶ/ር ቤተል",
      title: t("about.team.member.researcher2"),
      icon: <BookOpenCheck className="h-5 w-5" aria-hidden />,
      initials: "DB",
    },
  ];

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
          <h2 className="mt-5 text-xl font-extrabold">{t("brand.partner")}</h2>
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

      {/* Team */}
      <div className="mt-20">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-royal-700" aria-hidden />
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
            {t("about.team.title")}
          </h2>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          {lang === "en"
            ? "Six core members guide the school: the founder, a lead learning engineer and three researchers from Debre Berhan University's education research group, plus dedicated teaching staff."
            : "የመስራቹን፣ ዋና መሀንድሱን እና የደብረ ብርሃን ዩኒቨርሲቲ የትምህርት ምርምር ቡድን የሆኑ ሦስት ተመራማሪዎችን ጨምሮ ስድስት ዋና የቡድን አባላት ትምህርት ቤቱን ይመራሉ።"}
        </p>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {team.map((member) => (
            <div
              key={member.name}
              className="rounded-2xl border border-slate-200/60 bg-white/90 p-6 shadow-xl shadow-slate-900/5 transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-royal-700/10"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-royal-600 to-royal-800 text-lg font-extrabold text-white shadow-glow">
                {member.initials}
              </span>
              <h3 className="mt-4 font-extrabold text-slate-900">{member.name}</h3>
              <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                {member.icon} {member.title}
              </p>
            </div>
          ))}
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