"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n/LanguageProvider";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLang();

  useEffect(() => {
    toast.error(t("common.error"));
  }, [error, t]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-24 text-center">
      <h1 className="text-2xl font-extrabold text-slate-900">{t("common.error")}</h1>
      <button
        onClick={reset}
        className="mt-8 inline-flex h-11 items-center rounded-xl bg-royal-700 px-6 text-sm font-semibold text-white shadow-lg shadow-royal-700/25 transition hover:bg-royal-600"
      >
        {t("common.back")}
      </button>
    </div>
  );
}