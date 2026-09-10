"use client";

import type { ReactNode } from "react";
import { GraduationCap } from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";

export function AuthShell({ children }: { children: ReactNode }) {
  const { t } = useLang();

  return (
    <div className="relative">
      <div
        className="absolute inset-x-0 top-0 -z-10 h-[420px] bg-gradient-to-b from-royal-50 to-transparent"
        aria-hidden
      />
      <div className="mx-auto flex max-w-md flex-col px-4 py-14 sm:py-20">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-royal-600 to-royal-800 text-white shadow-xl shadow-royal-700/30">
            <GraduationCap className="h-7 w-7" aria-hidden />
          </span>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900">
            {t("brand.short")}
          </h1>
          <p className="text-sm text-slate-500">{t("brand.tagline")}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/60 bg-white/90 p-6 shadow-xl shadow-slate-900/5 backdrop-blur-sm sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}