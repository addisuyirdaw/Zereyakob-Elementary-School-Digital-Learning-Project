"use client";

import Link from "next/link";
import { Home } from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";

export default function NotFound() {
  const { t } = useLang();
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-24 text-center">
      <p className="text-7xl font-extrabold tracking-tight text-royal-700">404</p>
      <h1 className="mt-4 text-2xl font-extrabold text-slate-900">{t("404.title")}</h1>
      <p className="mt-2 text-slate-500">{t("404.desc")}</p>
      <Link
        href="/"
        className="mt-8 inline-flex h-11 items-center gap-2 rounded-xl bg-royal-700 px-6 text-sm font-semibold text-white shadow-lg shadow-royal-700/25 transition hover:bg-royal-600"
      >
        <Home className="h-4 w-4" aria-hidden />
        {t("404.home")}
      </Link>
    </div>
  );
}