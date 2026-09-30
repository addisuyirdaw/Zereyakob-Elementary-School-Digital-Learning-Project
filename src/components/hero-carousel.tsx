"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

export function HeroCarousel() {
  const { lang } = useLang();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [slides, setSlides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      if (!supabase) {
        if (!cancelled) setLoading(false);
        return;
      }
      
      // Fetch top 3 images from media table for the hero
      const { data: mediaData, error: mediaError } = await supabase
        .from("media")
        .select("*")
        .eq("type", "image")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(3);
        
      if (!cancelled) {
        if (!mediaError && mediaData && mediaData.length > 0) {
          // Map real DB photos to the slide format
          setSlides(mediaData.map((row: any) => ({
            image: row.url || "",
            titleEn: row.title || (lang === "en" ? "Zereyakob Project" : "ዘርአያዕቆብ ፕሮጀክት"),
            titleAm: row.title || (lang === "en" ? "Zereyakob Project" : "ዘርአያዕቆብ ፕሮጀክት"),
            subtitleEn: row.caption || "",
            subtitleAm: row.caption || "",
          })));
          setLoading(false);
          return;
        }

        // Fallback to media_showcase
        const { data: showcaseData } = await supabase
          .from("media_showcase")
          .select("*")
          .eq("media_type", "image")
          .order("display_order", { ascending: true })
          .order("created_at", { ascending: false })
          .limit(3);

        if (showcaseData && showcaseData.length > 0) {
          setSlides(showcaseData.map((row: any) => ({
            image: row.media_url || "",
            titleEn: row.title || (lang === "en" ? "Zereyakob Project" : "ዘርአያዕቆብ ፕሮጀክት"),
            titleAm: row.title || (lang === "en" ? "Zereyakob Project" : "ዘርአያዕቆብ ፕሮጀክት"),
            subtitleEn: row.caption || "",
            subtitleAm: row.caption || "",
          })));
        }
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [lang]);

  useEffect(() => {
    if (loading) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [loading, slides.length]);

  const next = () => setCurrentIndex((prev) => (prev + 1) % slides.length);
  const prev = () => setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);

  if (!loading && slides.length === 0) return null;

  return (
    <div className="relative h-[70vh] min-h-[500px] w-full overflow-hidden bg-slate-900 group">
      {slides.map((slide, index) => (
        <div
          key={index}
          className={cn(
            "absolute inset-0 transition-opacity duration-1000 ease-in-out",
            index === currentIndex ? "opacity-100 z-10" : "opacity-0 z-0"
          )}
        >
          {/* Subtle gradient just for the navigation elements (dots/arrows) */}
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent z-10" />
          <img
            src={slide.image}
            alt={slide.titleEn}
            className={cn(
              "absolute inset-0 h-full w-full object-cover transform transition-transform duration-[10000ms] ease-linear",
              index === currentIndex ? "scale-110" : "scale-100"
            )}
          />
        </div>
      ))}
      
      {/* Navigation Arrows */}
      <button onClick={prev} className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-3 text-white/70 hover:text-white bg-black/20 hover:bg-black/40 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300">
        <ChevronLeft className="h-8 w-8" />
      </button>
      <button onClick={next} className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-3 text-white/70 hover:text-white bg-black/20 hover:bg-black/40 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300">
        <ChevronRight className="h-8 w-8" />
      </button>

      {/* Dots */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex gap-3">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={cn(
              "h-2 rounded-full transition-all duration-500",
              index === currentIndex ? "w-10 bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]" : "w-3 bg-white/50 hover:bg-white/80"
            )}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
