"use client";

import {
  ArrowRight,
  BarChart3,
  CalendarCheck2,
  FileDown,
  Globe2,
  GraduationCap,
  HeartHandshake,
  Languages,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { ContactForm } from "@/components/contact-form";
import { PartnersGrid } from "@/components/partners";
import { ClubBanner } from "@/components/club-banner";
import { MediaCarousel } from "@/components/media-carousel";
import { MediaInterviews } from "@/components/media-interviews";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

function FeatureCard({
  icon,
  title,
  desc,
  className,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group rounded-2xl border border-slate-200/60 bg-white/90 p-6 shadow-xl shadow-slate-900/5 backdrop-blur-sm transition hover:-translate-y-1 hover:border-royal-300 hover:shadow-2xl hover:shadow-royal-700/10",
        className
      )}
    >
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-royal-50 text-royal-700 transition group-hover:bg-royal-700 group-hover:text-white">
        {icon}
      </div>
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{desc}</p>
    </div>
  );
}

export default function LandingPage() {
  const { t, lang } = useLang();

  const features = [
    {
      icon: <CalendarCheck2 className="h-5 w-5" aria-hidden />,
      title: t("landing.features.attendance.title"),
      desc: t("landing.features.attendance.desc"),
    },
    {
      icon: <BarChart3 className="h-5 w-5" aria-hidden />,
      title: t("landing.features.performance.title"),
      desc: t("landing.features.performance.desc"),
    },
    {
      icon: <FileDown className="h-5 w-5" aria-hidden />,
      title: t("landing.features.reports.title"),
      desc: t("landing.features.reports.desc"),
    },
    {
      icon: <Languages className="h-5 w-5" aria-hidden />,
      title: t("landing.features.bilingual.title"),
      desc: t("landing.features.bilingual.desc"),
    },
    {
      icon: <ShieldCheck className="h-5 w-5" aria-hidden />,
      title: t("landing.features.secure.title"),
      desc: t("landing.features.secure.desc"),
    },
    {
      icon: <HeartHandshake className="h-5 w-5" aria-hidden />,
      title: t("landing.features.support.title"),
      desc: t("landing.features.support.desc"),
    },
  ];

  return (
    <div className="overflow-hidden">
      {/* Media showcase — full-width immersive institutional slider */}
      <section id="media" className="w-full pt-16 sm:pt-20">
        <MediaCarousel />
      </section>

      {/* Community impact — DBU Club Connect cross-promotion */}
      <ClubBanner />

      {/* Partners (dynamic — managed from the Dashboard) */}
      <section id="partners" className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <PartnersGrid />
      </section>

      {/* Funding / sponsorship — calls-to-action for donors */}
      <section id="sponsor" className="border-t border-slate-200/70 bg-gradient-to-b from-white to-royal-50/60 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
              {t("funding.title")}
            </h2>
            <p className="mt-3 leading-relaxed text-slate-600">
              {t("funding.subtitle")}
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: <GraduationCap className="h-5 w-5" aria-hidden />,
                title: t("funding.tier.learner.title"),
                desc: t("funding.tier.learner.desc"),
              },
              {
                icon: <Users className="h-5 w-5" aria-hidden />,
                title: t("funding.tier.classroom.title"),
                desc: t("funding.tier.classroom.desc"),
              },
              {
                icon: <Globe2 className="h-5 w-5" aria-hidden />,
                title: t("funding.tier.tech.title"),
                desc: t("funding.tier.tech.desc"),
              },
            ].map((tier) => (
              <div
                key={tier.title}
                className="flex flex-col rounded-2xl border border-slate-200/60 bg-white/90 p-6 shadow-xl shadow-slate-900/5 backdrop-blur-sm transition hover:-translate-y-1 hover:border-royal-300"
              >
                <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-royal-50 text-royal-700">
                  {tier.icon}
                </span>
                <h3 className="text-base font-extrabold text-slate-900">
                  {tier.title}
                </h3>
                <p className="mt-1.5 flex-1 text-sm leading-relaxed text-slate-500">
                  {tier.desc}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="mailto:support@zereyakob.edu.et?subject=Sponsorship%20inquiry"
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-royal-700 px-7 text-base font-semibold text-white shadow-xl shadow-royal-700/30 transition hover:bg-royal-600"
            >
              <HeartHandshake className="h-5 w-5" aria-hidden />
              {t("funding.cta")}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
            <a
              href="/#contact"
              className="inline-flex h-12 items-center gap-2 rounded-xl border border-slate-300 bg-white/70 px-7 text-base font-semibold text-slate-700 backdrop-blur transition hover:border-royal-400 hover:text-royal-700"
            >
              {t("funding.ctaSecondary")}
            </a>
          </div>
          {/* Payment integration notice */}
          <div className="mt-6 flex flex-col items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/60 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
              {lang === "en"
                ? "Automated payment integration — Coming Soon"
                : "አውቶማቲክ ክፍያ ውህደት — በቅርቡ ይመጣል"}
            </span>
            <p className="text-center text-xs text-slate-400">
              {lang === "en"
                ? "Debre Berhan University verifies and co-supervises all funds."
                : "ደብረ ብርሃን ዩኒቨርሲቲ ሁሉንም ገንዘቦች ያረጋግጣል እና በጋራ ይቆጣጠራል።"}
            </p>
          </div>

        </div>
      </section>

      {/* Interviews & documentaries (dynamic — managed from the Dashboard) */}
      <section className="border-t border-slate-200/70 bg-white/60 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-royal-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-royal-700">
              {lang === "en" ? "Videos &amp; interviews" : "ቪዲዮዎች እና ቃለ መጠይቆች"}
            </span>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
              {t("md.interviews.title")}
            </h2>
            <p className="mt-3 leading-relaxed text-slate-600">
              {t("md.interviews.subtitle")}
            </p>
          </div>
          <div className="mt-10">
            <MediaInterviews />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
            {t("landing.features.title")}
          </h2>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <FeatureCard
              key={feature.title}
              icon={feature.icon}
              title={feature.title}
              desc={feature.desc}
            />
          ))}
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="border-t border-slate-200/70 bg-white/60 py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
              {t("sup.contact.title")}
            </h2>
            <p className="mt-3 max-w-md leading-relaxed text-slate-600">
              {t("sup.subtitle")}
            </p>
            <div className="mt-8 rounded-2xl border border-slate-200/60 bg-royal-50/60 p-6">
              <p className="text-sm font-semibold text-royal-800">
                {lang === "en"
                  ? "America · Netherlands · Europe — we would love to hear from you."
                  : "አሜሪካ · ኔዘርላንድ · አውሮፓ — ከእርስዎ መስማት እንወዳለን።"}
              </p>
            </div>
          </div>
          <ContactForm />
        </div>
      </section>
    </div>
  );
}