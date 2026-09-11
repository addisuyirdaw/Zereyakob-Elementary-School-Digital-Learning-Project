"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type Media = Database["public"]["Tables"]["media_showcase"]["Row"];

export function MediaCarousel() {
  const { t, lang } = useLang();
  const [items, setItems] = useState<Media[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [index, setIndex] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      if (!supabase) {
        if (!cancelled) setLoaded(true);
        return;
      }
      const { data } = await supabase
        .from("media_showcase")
        .select("*")
        .eq("media_type", "image")
        .order("display_order")
        .order("created_at");
      if (!cancelled) {
        setItems(data ?? []);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (items.length <= 1) return;
    timer.current = setInterval(
      () => setIndex((i) => (i + 1) % items.length),
      5000
    );
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [items.length, index]);

  if (!loaded) return null;
  if (items.length === 0) return null;

  const go = (next: number) =>
    setIndex(((next % items.length) + items.length) % items.length);
  const current = items[index];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="group relative overflow-hidden rounded-3xl border border-slate-200/60 bg-slate-900 shadow-2xl shadow-slate-900/20">
        <div
          className="relative aspect-video w-full overflow-hidden"
          key={current.id}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.media_url}
            alt={current.title}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent p-6 pt-20">
            {current.title && (
              <h3 className="text-lg font-extrabold text-white sm:text-xl">
                {current.title}
              </h3>
            )}
            {current.caption && (
              <p className="mt-1 max-w-2xl text-sm text-slate-300">
                {current.caption}
              </p>
            )}
          </div>
        </div>

        {items.length > 1 && (
          <>
            <button
              onClick={() => go(index - 1)}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-slate-800 shadow-lg opacity-0 transition hover:bg-white group-hover:opacity-100"
              aria-label={lang === "en" ? "Previous" : "ቀዳሚ"}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => go(index + 1)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-slate-800 shadow-lg opacity-0 transition hover:bg-white group-hover:opacity-100"
              aria-label={lang === "en" ? "Next" : "ቀጣይ"}
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            <div className="absolute bottom-3 right-4 flex gap-1.5">
              {items.map((item, i) => (
                <button
                  key={item.id}
                  onClick={() => setIndex(i)}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === index ? "w-6 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"
                  )}
                  aria-label={`${lang === "en" ? "Slide" : "ስላይድ"} ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}