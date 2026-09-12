"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Film,
  Image as ImageIcon,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  Video,
} from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/layout";
import { MediaFormModal, type MediaItem } from "@/components/dashboard/media-form";

function youtubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/
  );
  return match?.[1] ?? null;
}

function isVideoFile(url: string): boolean {
  return /\.(mp4|webm|mov|ogg)($|\?)/i.test(url) || url.includes("/storage/v1/object/public/media/");
}

export default function MediaPage() {
  const { t, lang } = useLang();

  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MediaItem | null>(null);
  const [filterType, setFilterType] = useState<"all" | "image" | "video">("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    // 1. Try public.media table
    const { data: mediaData, error: mediaError } = await supabase
      .from("media")
      .select("*")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (!mediaError && mediaData && mediaData.length > 0) {
      setItems(
        mediaData.map((row: any) => ({
          id: row.id,
          title: row.title ?? "",
          url: row.url ?? "",
          type: (row.type === "video" ? "video" : "image") as "image" | "video",
          caption: row.caption ?? "",
          display_order: Number(row.display_order) || 0,
          created_at: row.created_at,
          is_featured_video: false,
        }))
      );
      setLoading(false);
      return;
    }

    // 2. Fallback to media_showcase if media table errored or had 0 rows while media_showcase has data
    const { data: showcaseData } = await supabase
      .from("media_showcase")
      .select("*")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (showcaseData && showcaseData.length > 0) {
      setItems(
        showcaseData.map((row: any) => ({
          id: row.id,
          title: row.title ?? "",
          url: row.media_url ?? "",
          type: (row.media_type === "video" || row.media_type === "interview" ? "video" : "image") as "image" | "video",
          caption: row.caption ?? "",
          display_order: Number(row.display_order) || 0,
          created_at: row.created_at,
          is_featured_video: Boolean(row.is_featured_video),
        }))
      );
    } else if (mediaData) {
      setItems([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const thumb = (item: MediaItem) => {
    if (item.type === "image") {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.url} alt="" className="h-full w-full object-cover" />
      );
    }
    const id = youtubeId(item.url);
    if (id) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
          alt=""
          className="h-full w-full object-cover"
        />
      );
    }
    if (isVideoFile(item.url)) {
      return <video src={item.url} muted playsInline className="h-full w-full object-cover" />;
    }
    return (
      <span className="flex h-full w-full items-center justify-center bg-slate-900">
        <Film className="h-6 w-6 text-white/70" aria-hidden />
      </span>
    );
  };

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const a = items[index];
    const b = items[target];
    const supabase = createClient();
    if (!supabase) return;

    // Swap display_order
    const aOrder = b.display_order;
    const bOrder = a.display_order === b.display_order ? b.display_order + dir : a.display_order;

    await supabase.from("media").update({ display_order: aOrder }).eq("id", a.id);
    await supabase.from("media").update({ display_order: bOrder }).eq("id", b.id);
    await supabase.from("media_showcase").update({ display_order: aOrder }).eq("id", a.id);
    await supabase.from("media_showcase").update({ display_order: bOrder }).eq("id", b.id);

    load();
  };

  const updateDisplayOrder = async (item: MediaItem, newOrder: number) => {
    const supabase = createClient();
    if (!supabase) return;

    await supabase.from("media").update({ display_order: newOrder }).eq("id", item.id);
    await supabase.from("media_showcase").update({ display_order: newOrder }).eq("id", item.id);
    toast.success(lang === "en" ? `Order updated to #${newOrder}` : `ቅደም ተከተል ወደ #${newOrder} ተቀይሯል`);
    load();
  };

  const toggleFeatured = async (item: MediaItem) => {
    const supabase = createClient();
    if (!supabase) return;
    const nextVal = !item.is_featured_video;

    // update showcase table
    await supabase
      .from("media_showcase")
      .update({ is_featured_video: nextVal })
      .eq("id", item.id);

    toast.success(t("md.saved"));
    load();
  };

  const remove = async (item: MediaItem) => {
    if (!window.confirm(`${t("common.deleteConfirm")}: ${item.title || item.url}?`)) return;
    const supabase = createClient();
    if (!supabase) return;

    await supabase.from("media").delete().eq("id", item.id);
    await supabase.from("media_showcase").delete().eq("id", item.id);

    toast.success(t("md.deleted"));
    load();
  };

  const photoCount = useMemo(
    () => items.filter((i) => i.type === "image").length,
    [items]
  );
  const videoCount = useMemo(
    () => items.filter((i) => i.type === "video").length,
    [items]
  );

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filterType !== "all" && item.type !== filterType) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesCaption = (item.caption ?? "").toLowerCase().includes(q);
        const matchesUrl = item.url.toLowerCase().includes(q);
        if (!matchesTitle && !matchesCaption && !matchesUrl) return false;
      }
      return true;
    });
  }, [items, filterType, search]);

  if (loading) {
    return <div className="py-24 text-center text-sm text-slate-400">{t("common.loading")}</div>;
  }

  return (
    <div>
      <PageHeader
        title={t("md.title")}
        subtitle={t("md.subtitle")}
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden />
            {t("md.add")}
          </Button>
        }
      />

      {/* Stats row */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            {lang === "en" ? "Total items" : "አጠቃላይ ይዘቶች"}
          </p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">{items.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            {lang === "en" ? "Photos & Gallery" : "ፎቶዎች እና ጋለሪ"}
          </p>
          <p className="mt-1 text-2xl font-extrabold text-royal-700">{photoCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            {lang === "en" ? "Videos & Stories" : "ቪዲዮዎች እና ታሪኮች"}
          </p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-700">{videoCount}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <button
            onClick={() => setFilterType("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              filterType === "all"
                ? "bg-royal-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {t("common.all")} ({items.length})
          </button>
          <button
            onClick={() => setFilterType("image")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              filterType === "image"
                ? "bg-royal-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <ImageIcon className="h-3.5 w-3.5" />
            {t("md.typeImage")} ({photoCount})
          </button>
          <button
            onClick={() => setFilterType("video")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              filterType === "video"
                ? "bg-royal-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Video className="h-3.5 w-3.5" />
            {t("md.typeVideo")} ({videoCount})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={lang === "en" ? "Search media..." : "ሚዲያ ፈልግ..."}
            className="pl-9"
          />
        </div>
      </div>

      {/* Media List */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
        {filteredItems.length === 0 ? (
          <div className="py-16 text-center">
            <Film className="mx-auto h-12 w-12 text-slate-300" />
            <h3 className="mt-3 text-base font-bold text-slate-700">
              {lang === "en" ? "No media items found" : "ምንም ሚዲያ አልተገኘም"}
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              {lang === "en"
                ? "Upload photos or videos to showcase on the public website."
                : "በህዝብ ድረ-ገጽ ላይ የሚታዩ ፎቶዎችን ወይም ቪዲዮዎችን ይጫኑ።"}
            </p>
            <Button
              className="mt-4"
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              {t("md.add")}
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filteredItems.map((item, i) => (
              <li
                key={item.id}
                className="flex flex-col gap-4 p-4 transition hover:bg-slate-50/50 sm:flex-row sm:items-center"
              >
                {/* Priority order controls */}
                <div className="flex items-center gap-1">
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      className="rounded-md p-1 text-slate-400 transition hover:bg-royal-50 hover:text-royal-700 disabled:opacity-30"
                      title={t("md.up")}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => move(i, 1)}
                      disabled={i === filteredItems.length - 1}
                      className="rounded-md p-1 text-slate-400 transition hover:bg-royal-50 hover:text-royal-700 disabled:opacity-30"
                      title={t("md.down")}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Inline quick priority number edit */}
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-semibold text-slate-400">Order</span>
                    <input
                      type="number"
                      defaultValue={item.display_order}
                      onBlur={(e) => {
                        const val = Number(e.target.value);
                        if (!isNaN(val) && val !== item.display_order) {
                          updateDisplayOrder(item, val);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      className="w-12 rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-center font-mono text-xs font-bold text-slate-800 transition focus:border-royal-500 focus:bg-white focus:outline-none"
                      title={lang === "en" ? "Edit priority order number" : "የቅደም ተከተል ቁጥር ይቀይሩ"}
                    />
                  </div>
                </div>

                {/* Media thumbnail */}
                <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm">
                  {thumb(item)}
                  <span className="absolute bottom-1 right-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white backdrop-blur-sm">
                    {item.type}
                  </span>
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="truncate font-bold text-slate-900">
                      {item.title || (lang === "en" ? "Untitled" : "ያለ ርዕስ")}
                    </h4>
                    <Badge tone={item.type === "image" ? "royal" : "green"}>
                      {item.type === "image" ? t("md.typeImage") : t("md.typeVideo")}
                    </Badge>
                    {item.is_featured_video && (
                      <Badge tone="violet">
                        <Star className="mr-1 h-3 w-3" /> {t("md.featuredVideo")}
                      </Badge>
                    )}
                  </div>
                  {item.caption && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-slate-600">{item.caption}</p>
                  )}
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 inline-flex items-center gap-1 truncate font-mono text-xs text-slate-400 hover:text-royal-600"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    <span className="truncate">{item.url}</span>
                  </a>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 self-end sm:self-center">
                  {item.type === "video" && (
                    <button
                      onClick={() => toggleFeatured(item)}
                      title={t("md.featured")}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition ${
                        item.is_featured_video
                          ? "bg-royal-50 text-royal-600"
                          : "text-slate-400 hover:bg-royal-50 hover:text-royal-600"
                      }`}
                    >
                      <Star className={`h-4 w-4 ${item.is_featured_video ? "fill-royal-600" : ""}`} />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEditing(item);
                      setModalOpen(true);
                    }}
                    title={t("common.edit")}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-royal-50 hover:text-royal-700"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => remove(item)}
                    title={t("common.delete")}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Form Modal */}
      <MediaFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        item={editing}
        onSaved={load}
      />
    </div>
  );
}