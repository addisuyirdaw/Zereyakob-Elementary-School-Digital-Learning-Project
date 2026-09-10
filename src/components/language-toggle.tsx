"use client";

import { Globe } from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import type { Lang } from "@/lib/i18n/translations";
import { cn } from "@/lib/utils";

const options: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "am", label: "አማርኛ" },
];

export function LanguageToggle({ className }: { className?: string }) {
  const { lang, setLang } = useLang();

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/70 p-1 backdrop-blur",
        className
      )}
      role="group"
      aria-label="Language / ቋንቋ"
    >
      <Globe className="ml-1.5 h-4 w-4 text-slate-400" aria-hidden />
      {options.map((option) => (
        <button
          key={option.code}
          onClick={() => setLang(option.code)}
          aria-pressed={lang === option.code}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold transition-all",
            lang === option.code
              ? "bg-royal-700 text-white shadow-md shadow-royal-700/30"
              : "text-slate-500 hover:text-royal-700"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}