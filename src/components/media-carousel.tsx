"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export interface GalleryPhoto {
  id: string;
  title: string;
  url: string;
  caption?: string;
  display_order: number;
}

const AUTOPLAY_MS = 5000;

function isVideoFile(url: string): boolean {
  return /\.(mp4|webm|mov|ogg)($|\?)/i.test(url);
}

export function MediaCarousel() {
  const { t } = useLang();
  const [items, setItems] = useState<GalleryPhoto[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      if (!supabase) {
        if (!cancelled) setLoaded(true);
        return;
      }

      // 1. Fetch images from 'media' table first
      const { data: mediaData, error: mediaError } = await supabase
        .from("media")
        .select("*")
        .eq("type", "image")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (!mediaError && mediaData && mediaData.length > 0) {
        if (!cancelled) {
          setItems(
            mediaData.map((row: any) => ({
              id: row.id,
              title: row.title ?? "",
              url: row.url ?? "",
              caption: row.caption ?? "",
              display_order: Number(row.display_order) || 0,
            }))
          );
          setLoaded(true);
        }
        return;
      }

      // 2. Fallback to 'media_showcase' table
      const { data: showcaseData } = await supabase
        .from("media_showcase")
        .select("*")
        .eq("media_type", "image")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (!cancelled) {
        if (showcaseData && showcaseData.length > 0) {
          setItems(
            showcaseData.map((row: any) => ({
              id: row.id,
              title: row.title ?? "",
              url: row.media_url ?? "",
              caption: row.caption ?? "",
              display_order: Number(row.display_order) || 0,
            }))
          );
        } else {
          setItems([]);
        }
        setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (items.length <= 1 || paused) return;
    const id = setInterval(
      () => setIndex((i) => (i + 1) % items.length),
      AUTOPLAY_MS
    );
    return () => clearInterval(id);
  }, [items.length, paused, tick]);

  if (!loaded || items.length === 0) return null;

  const go = (next: number) => {
    setIndex(((next % items.length) + items.length) % items.length);
    setTick((v) => v + 1);
  };
  const togglePause = () => setPaused((p) => !p);

  return (
    <div
      className="group relative mx-auto w-full max-w-6xl overflow-hidden rounded-2xl bg-slate-100 shadow-2xl shadow-slate-900/20"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="aspect-video max-h-[500px] w-full">
        <div
          className="flex h-full transition-transform duration-700 ease-in-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {items.map((item) => (
            <div key={item.id} className="relative h-full w-full shrink-0 overflow-hidden">
              {isVideoFile(item.url) ? (
                <video
                  src={item.url}
                  muted
                  playsInline
                  className="absolute inset-0 z-10 mx-auto my-auto max-h-full max-w-full bg-slate-950 object-contain shadow-2xl shadow-slate-950/40"
                />
              ) : (
                <>
                  {/* Soft blurred background for portrait or atypical ratio images */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white via-slate-50 to-royal-50/50" aria-hidden />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.url}
                    alt=""
                    aria-hidden
                    loading="lazy"
                    className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl opacity-25"
                  />
                  <div className="absolute inset-0 bg-white/60" aria-hidden />
                  {/* Main image — centered and fully crisp */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.url}
                    alt={item.title}
                    loading="lazy"
                    className="absolute inset-0 z-10 mx-auto my-auto max-h-full max-w-full rounded-lg object-contain ring-1 ring-slate-900/10 shadow-2xl shadow-slate-900/20"
                  />
                </>
              )}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-1/2 bg-gradient-to-t from-slate-950/85 via-slate-900/35 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 z-20 p-4 pb-14 sm:p-6 sm:pb-16">
                <div className="mx-auto flex max-w-3xl flex-col items-start">
                  {item.title && (
                    <h2 className="max-w-3xl text-lg font-extrabold leading-tight tracking-tight text-white text-balance drop-shadow-lg sm:text-2xl lg:text-3xl">
                      {item.title}
                    </h2>
                  )}
                  {item.caption && (
                    <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-200/90 drop-shadow line-clamp-2">
                      {item.caption}
                    </p>
                  )}
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-amber-400 px-5 text-sm font-bold text-slate-950 shadow-lg shadow-amber-400/30 transition hover:bg-amber-300 sm:h-11 sm:text-base"
                  >
                    {t("carousel.explore")}
                    <ArrowUpRight className="h-4 w-4" aria-hidden />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {items.length > 1 && (
        <>
          {/* Bottom-edge navigation: arrows on the sides, dots in the middle */}
          <div className="absolute inset-x-0 bottom-4 flex items-center justify-between px-4 sm:bottom-6 sm:px-8">
            <button
              onClick={() => go(index - 1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white/85 text-slate-700 shadow-sm backdrop-blur transition hover:bg-white"
              aria-label={t("carousel.prev")}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-1.5">
              {items.map((item, i) => (
                <button
                  key={item.id}
                  onClick={() => go(i)}
                  className={cn(
                    "rounded-full transition-all duration-300",
                    i === index
                      ? "h-2 w-6 bg-slate-900"
                      : "h-2 w-2 bg-slate-900/30 hover:bg-slate-900/50"
                  )}
                  aria-label={`${i + 1} / ${items.length}`}
                />
              ))}
            </div>

            <button
              onClick={() => go(index + 1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white/85 text-slate-700 shadow-sm backdrop-blur transition hover:bg-white"
              aria-label={t("carousel.next")}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={togglePause}
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white/85 text-slate-700 shadow-sm backdrop-blur transition hover:bg-white sm:right-8 sm:top-6"
            aria-label={paused ? t("carousel.play") : t("carousel.pause")}
          >
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
        </>
      )}
    </div>
  );
}