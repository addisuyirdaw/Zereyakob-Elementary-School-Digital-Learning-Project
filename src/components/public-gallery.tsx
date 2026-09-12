"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  Image as ImageIcon,
  X,
} from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { createClient } from "@/lib/supabase/client";

export interface GalleryPhoto {
  id: string;
  title: string;
  url: string;
  caption?: string;
  display_order: number;
}

export function PhotoGalleryGrid({ compact = false }: { compact?: boolean }) {
  const { t, lang } = useLang();
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      if (!supabase) {
        if (!cancelled) setLoading(false);
        return;
      }

      // 1. Fetch images from 'media' table
      const { data: mediaData, error: mediaError } = await supabase
        .from("media")
        .select("*")
        .eq("type", "image")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (!mediaError && mediaData && mediaData.length > 0) {
        if (!cancelled) {
          setPhotos(
            mediaData.map((row: any) => ({
              id: row.id,
              title: row.title ?? "",
              url: row.url ?? "",
              caption: row.caption ?? "",
              display_order: Number(row.display_order) || 0,
            }))
          );
          setLoading(false);
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
          setPhotos(
            showcaseData.map((row: any) => ({
              id: row.id,
              title: row.title ?? "",
              url: row.media_url ?? "",
              caption: row.caption ?? "",
              display_order: Number(row.display_order) || 0,
            }))
          );
        } else {
          setPhotos([]);
        }
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (activePhotoIndex === null) return;
      if (e.key === "Escape") {
        setActivePhotoIndex(null);
      } else if (e.key === "ArrowLeft") {
        setActivePhotoIndex((prev) =>
          prev !== null ? (prev - 1 + photos.length) % photos.length : 0
        );
      } else if (e.key === "ArrowRight") {
        setActivePhotoIndex((prev) =>
          prev !== null ? (prev + 1) % photos.length : 0
        );
      }
    },
    [activePhotoIndex, photos.length]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-slate-400">
        {t("common.loading")}
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-dashed border-slate-300 bg-white/70 p-8 text-center shadow-sm">
        <ImageIcon className="mx-auto h-10 w-10 text-royal-400" />
        <h4 className="mt-3 text-sm font-bold text-slate-700">
          {lang === "en" ? "Photo Gallery Coming Soon" : "የፎቶ ጋለሪ በቅርቡ ይቀርባል"}
        </h4>
        <p className="mt-1 text-xs text-slate-500">
          {lang === "en"
            ? "New photos of the campus and classrooms will be published here."
            : "የትምህርት ቤቱ እና የክፍል ውስጥ ፎቶዎች በቅርቡ እዚህ ይለጠፋሉ።"}
        </p>
      </div>
    );
  }

  const displayedPhotos = compact ? photos.slice(0, 6) : photos;
  const activePhoto = activePhotoIndex !== null ? photos[activePhotoIndex] : null;

  return (
    <div>
      {/* Structured Responsive Photo Grid (No Auto-Carousel) */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {displayedPhotos.map((photo, index) => (
          <div
            key={photo.id}
            onClick={() => setActivePhotoIndex(index)}
            className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-royal-300 hover:shadow-xl hover:shadow-slate-900/10"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && setActivePhotoIndex(index)}
          >
            {/* Image Container with smooth zoom hover */}
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.title || "Zereyakob photo"}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
              />
              {/* View Overlay on Hover */}
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/20 opacity-0 backdrop-blur-[2px] transition-opacity duration-300 group-hover:opacity-100">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-xs font-bold text-slate-900 shadow-lg shadow-black/20">
                  <Eye className="h-4 w-4 text-royal-600" />
                  {t("gallery.view")}
                </span>
              </div>
            </div>

            {/* Content & Caption */}
            <div className="flex flex-1 flex-col justify-between p-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 line-clamp-1 group-hover:text-royal-700">
                  {photo.title || (lang === "en" ? "Campus Moment" : "የትምህርት ቤት ገጽታ")}
                </h3>
                {photo.caption && (
                  <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                    {photo.caption}
                  </p>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                <span className="font-mono">#{photo.display_order}</span>
                <span className="font-semibold text-royal-600 group-hover:underline">
                  {t("gallery.view")} →
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox Modal for Full View */}
      {activePhoto && activePhotoIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setActivePhotoIndex(null)}
        >
          {/* Main Lightbox Box */}
          <div
            className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-slate-900 text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header bar */}
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-3.5">
              <div className="min-w-0 flex-1 pr-4">
                <h3 className="truncate text-base font-extrabold text-white">
                  {activePhoto.title || (lang === "en" ? "Photo Preview" : "የፎቶ ቅድመ እይታ")}
                </h3>
                <p className="text-xs text-slate-400">
                  {t("gallery.photoCount", {
                    current: activePhotoIndex + 1,
                    total: photos.length,
                  })}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={activePhoto.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
                  title="Open original"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                <button
                  onClick={() => setActivePhotoIndex(null)}
                  className="rounded-lg p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
                  aria-label={t("gallery.close")}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Photo Center */}
            <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black/50 p-2 sm:p-4 min-h-[320px] max-h-[65vh]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activePhoto.url}
                alt={activePhoto.title}
                className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
              />

              {/* Prev / Next buttons */}
              {photos.length > 1 && (
                <>
                  <button
                    onClick={() =>
                      setActivePhotoIndex(
                        (activePhotoIndex - 1 + photos.length) % photos.length
                      )
                    }
                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-black/60 p-2.5 text-white backdrop-blur transition hover:bg-white/30"
                    aria-label={t("gallery.prev")}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() =>
                      setActivePhotoIndex((activePhotoIndex + 1) % photos.length)
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-black/60 p-2.5 text-white backdrop-blur transition hover:bg-white/30"
                    aria-label={t("gallery.next")}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>

            {/* Caption Footer */}
            {activePhoto.caption && (
              <div className="border-t border-white/10 bg-slate-950/80 px-6 py-3">
                <p className="text-xs leading-relaxed text-slate-300">
                  {activePhoto.caption}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
