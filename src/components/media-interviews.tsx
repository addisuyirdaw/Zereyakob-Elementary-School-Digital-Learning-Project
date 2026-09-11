"use client";

import { useEffect, useState } from "react";
import { Film, PlaySquare } from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type Media = Database["public"]["Tables"]["media_showcase"]["Row"];

function youtubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/
  );
  return match?.[1] ?? null;
}

function isMp4(url: string): boolean {
  return /\.mp4($|\?)/i.test(url);
}

function Thumb({ item, className }: { item: Media; className?: string }) {
  const id = youtubeId(item.media_url);
  if (id) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
        alt={item.title}
        className={cn("object-cover", className)}
      />
    );
  }
  return (
    <span className={cn("flex items-center justify-center bg-slate-900", className)}>
      <Film className="h-8 w-8 text-white/70" aria-hidden />
    </span>
  );
}

function Player({ item }: { item: Media }) {
  const id = youtubeId(item.media_url);
  if (id) {
    return (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}`}
        title={item.title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="h-full w-full"
      />
    );
  }
  if (isMp4(item.media_url)) {
    return (
      <video src={item.media_url} controls className="h-full w-full bg-black" />
    );
  }
  return (
    <iframe
      src={item.media_url}
      title={item.title}
      allowFullScreen
      className="h-full w-full"
    />
  );
}

export function MediaInterviews() {
  const { t, lang } = useLang();
  const [items, setItems] = useState<Media[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

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
        .in("media_type", ["video", "interview"])
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
    if (!items.length) return;
    const featured = items.find((i) => i.is_featured_video);
    setActiveId((current) => {
      if (current && items.some((i) => i.id === current)) return current;
      return (featured ?? items[0]).id;
    });
  }, [items]);

  if (!loaded) return null;
  if (items.length === 0) return null;

  const active = items.find((i) => i.id === activeId) ?? items[0];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="overflow-hidden rounded-3xl border border-slate-200/60 bg-slate-950 shadow-2xl shadow-slate-900/20">
          <div className="aspect-video w-full">{active ? <Player item={active} /> : null}</div>
          {active && (active.title || active.caption) && (
            <div className="bg-slate-950 px-6 py-4">
              {active.title && (
                <h3 className="text-lg font-extrabold text-white">{active.title}</h3>
              )}
              {active.caption && (
                <p className="mt-0.5 text-sm text-slate-400">{active.caption}</p>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-royal-700">
            <PlaySquare className="h-4 w-4" aria-hidden />
            {lang === "en" ? "All interviews" : "ሁሉም ቃለ መጠይቆች"}
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto lg:max-h-[22rem]">
            {items.map((item) => {
              const selected = item.id === active?.id;
              const id = youtubeId(item.media_url);
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveId(item.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left transition",
                    selected
                      ? "border-royal-400 bg-royal-50 shadow-md shadow-royal-700/10"
                      : "border-slate-200/60 bg-white/80 hover:border-royal-300"
                  )}
                >
                  <span className="relative flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl">
                    <Thumb
                      item={item}
                      className={id ? "h-full w-full" : "h-full w-full"}
                    />
                    {id && (
                      <span className="absolute inset-0 flex items-center justify-center bg-slate-950/30 text-white">
                        <PlaySquare className="h-6 w-6" aria-hidden />
                      </span>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-slate-900">
                      {item.title || (lang === "en" ? "Untitled" : "ያለ ርዕስ")}
                    </span>
                    {item.caption && (
                      <span className="mt-0.5 line-clamp-2 block text-xs text-slate-400">
                        {item.caption}
                      </span>
                    )}
                    {item.is_featured_video && (
                      <span className="mt-1 inline-flex items-center rounded-full bg-royal-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-royal-700">
                        {t("md.featuredVideo")}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}