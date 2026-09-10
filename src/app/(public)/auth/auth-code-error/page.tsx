"use client";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";

export default function AuthCodeErrorPage() {
  const { t } = useLang();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
        <TriangleAlert className="h-7 w-7" aria-hidden />
      </span>
      <h1 className="mt-4 text-xl font-extrabold text-slate-900">
        {t("auth.err.unknown")}
      </h1>
      <Link
        href="/signin"
        className="mt-6 inline-flex h-11 items-center rounded-xl bg-royal-700 px-6 text-sm font-semibold text-white shadow-lg shadow-royal-700/25 transition hover:bg-royal-600"
      >
        {t("auth.signIn")}
      </Link>
    </div>
  );
}