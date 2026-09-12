"use client";

import { useEffect, useState } from "react";
import { Film, PlaySquare, Video } from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export interface VideoItem {
  id: string;
  title: string;
  url: string;
  caption?: string;
  display_order: number;
  is_featured_video?: boolean;
}

function youtubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/
  );
  return match?.[1] ?? null;
}

function isVideoFile(url: string): boolean {
  return /\.(mp4|webm|mov|ogg)($|\?)/i.test(url) || url.includes("/storage/v1/object/public/media/");
}

function Thumb({ item, className }: { item: VideoItem; className?: string }) {
  const id = youtubeId(item.url);
  if (id) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
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

function Player({ item }: { item: VideoItem }) {
  const id = youtubeId(item.url);
  if (id) {
    return (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}?rel=0`}
        title={item.title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="h-full w-full"
      />
    );
  }
  if (isVideoFile(item.url)) {
    return (
      <video
        src={item.url}
        controls
        playsInline
        className="h-full w-full bg-black object-contain"
      />
    );
  }
  return (
    <iframe
      src={item.url}
      title={item.title}
      allowFullScreen
      className="h-full w-full"
    />
  );
}

export function MediaInterviews() {
  const { t, lang } = useLang();
  const [items, setItems] = useState<VideoItem[]>([]);
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

      // 1. Fetch from 'media' table first
      const { data: mediaData, error: mediaError } = await supabase
        .from("media")
        .select("*")
        .eq("type", "video")
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
              is_featured_video: false,
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
        .in("media_type", ["video", "interview"])
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
              is_featured_video: Boolean(row.is_featured_video),
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
    if (!items.length) return;
    const featured = items.find((i) => i.is_featured_video);
    setActiveId((current) => {
      if (current && items.some((i) => i.id === current)) return current;
      return (featured ?? items[0]).id;
    });
  }, [items]);

  if (!loaded) {
    return (
      <div className="mx-auto flex max-w-xl items-center justify-center py-12 text-sm text-slate-400">
        {t("common.loading")}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-dashed border-slate-300 bg-white/60 p-8 text-center shadow-sm">
        <Video className="mx-auto h-12 w-12 text-royal-400" />
        <h3 className="mt-3 text-base font-bold text-slate-800">
          {lang === "en" ? "Stories & Documentaries Coming Soon" : "ታሪኮች እና ቪዲዮዎች በቅርቡ ይቀርባሉ"}
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          {t("md.noMedia")}
        </p>
      </div>
    );
  }

  const active = items.find((i) => i.id === activeId) ?? items[0];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Main Player */}
        <div className="overflow-hidden rounded-3xl border border-slate-200/60 bg-slate-950 shadow-2xl shadow-slate-900/20">
          <div className="aspect-video w-full">{active ? <Player item={active} /> : null}</div>
          {active && (active.title || active.caption) && (
            <div className="bg-slate-950 px-6 py-4">
              {active.title && (
                <h3 className="text-lg font-extrabold text-white">{active.title}</h3>
              )}
              {active.caption && (
                <p className="mt-1 text-sm leading-relaxed text-slate-400">{active.caption}</p>
              )}
            </div>
          )}
        </div>

        {/* Playlist */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-sm font-bold text-royal-700">
            <span className="flex items-center gap-2">
              <PlaySquare className="h-4 w-4" aria-hidden />
              {lang === "en" ? "All stories & interviews" : "ሁሉም ታሪኮች እና ቃለ መጠይቆች"}
            </span>
            <span className="text-xs font-semibold text-slate-400">
              {items.length} {lang === "en" ? "videos" : "ቪዲዮዎች"}
            </span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto pr-1 lg:max-h-[26rem]">
            {items.map((item) => {
              const selected = item.id === active?.id;
              const id = youtubeId(item.url);
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveId(item.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left transition",
                    selected
                      ? "border-royal-400 bg-royal-50 shadow-md shadow-royal-700/10 ring-1 ring-royal-400"
                      : "border-slate-200/60 bg-white/80 hover:border-royal-300 hover:bg-white"
                  )}
                >
                  <span className="relative flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl">
                    <Thumb
                      item={item}
                      className={id ? "h-full w-full" : "h-full w-full"}
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-slate-950/30 text-white">
                      <PlaySquare className="h-6 w-6 drop-shadow" aria-hidden />
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-slate-900">
                      {item.title || (lang === "en" ? "Untitled story" : "ያለ ርዕስ")}
                    </span>
                    {item.caption && (
                      <span className="mt-0.5 line-clamp-2 block text-xs text-slate-500">
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