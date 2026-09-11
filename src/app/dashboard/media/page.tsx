"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Film,
  Pencil,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { MediaFormModal } from "@/components/dashboard/media-form";
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

const TYPE_TONE: Record<Media["media_type"], "royal" | "green" | "amber"> = {
  image: "royal",
  video: "green",
  interview: "amber",
};

export default function MediaPage() {
  const { t, lang } = useLang();

  const [items, setItems] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Media | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("media_showcase")
      .select("*")
      .order("display_order")
      .order("created_at");
    setItems(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const thumb = (item: Media) => {
    if (item.media_type === "image") {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={item.media_url} alt="" className="h-full w-full object-cover" />;
    }
    const id = youtubeId(item.media_url);
    if (id) {
      // eslint-disable-next-line @next/next/no-img-element
      return (
        <img
          src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
          alt=""
          className="h-full w-full object-cover"
        />
      );
    }
    if (isMp4(item.media_url)) {
      return <video src={item.media_url} muted playsInline className="h-full w-full object-cover" />;
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
    const { error } = await supabase
      .from("media_showcase")
      .update({ display_order: b.display_order })
      .eq("id", a.id);
    if (error) return;
    await supabase
      .from("media_showcase")
      .update({ display_order: a.display_order })
      .eq("id", b.id);
    load();
  };

  const toggleFeatured = async (item: Media) => {
    const supabase = createClient();
    if (!supabase) return;
    const { error } = await supabase
      .from("media_showcase")
      .update({ is_featured_video: !item.is_featured_video })
      .eq("id", item.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("md.saved"));
    load();
  };

  const remove = async (item: Media) => {
    if (!window.confirm(`${t("common.deleteConfirm")}: ${item.title || item.media_url}?`)) return;
    const supabase = createClient();
    if (!supabase) return;
    const { error } = await supabase.from("media_showcase").delete().eq("id", item.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("md.deleted"));
    load();
  };

  const videoCount = useMemo(
    () => items.filter((i) => i.media_type === "video" || i.media_type === "interview").length,
    [items]
  );
  const featuredCount = useMemo(
    () => items.filter((i) => i.is_featured_video).length,
    [items]
  );

  if (loading) {
    return <div className="py-24 text-center text-sm text-slate-400">{t("common.loading")}</div>;
  }

  return (
    <div>
      <PageHeader
        title={t("md.title")}
        subtitle={t("md.subtitle")}
        actions={
          <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
            <Plus className="h-4 w-4" aria-hidden />
            {t("md.add")}
          </Button>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            {lang === "en" ? "Total items" : "አጠቃላይ ይዘቶች"}
          </p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">{items.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            {lang === "en" ? "Videos & interviews" : "ቪዲዮዎች እና ቃለ መጠይቆች"}
          </p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">{videoCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            {lang === "en" ? "Featured on landing" : "በመነሻ ገጽ ላይ የቀረቡ"}
          </p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">{featuredCount}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white">
        <ul className="divide-y divide-slate-100">
          {items.map((item, i) => (
            <li key={item.id} className="flex items-center gap-4 px-4 py-3">
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
                  disabled={i === items.length - 1}
                  className="rounded-md p-1 text-slate-400 transition hover:bg-royal-50 hover:text-royal-700 disabled:opacity-30"
                  title={t("md.down")}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="h-14 w-24 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                {thumb(item)}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-bold text-slate-900">
                    {item.title || (lang === "en" ? "Untitled" : "ያለ ርዕስ")}
                  </p>
                  <Badge tone={TYPE_TONE[item.media_type]}>
                    {t(`md.type${item.media_type[0].toUpperCase()}${item.media_type.slice(1)}`)}
                  </Badge>
                  {item.is_featured_video && (
                    <Badge tone="violet">
                      <Star className="mr-1 h-3 w-3" /> {t("md.featuredVideo")}
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 truncate font-mono text-xs text-slate-400">
                  #{item.display_order} · {item.media_url}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => toggleFeatured(item)}
                  title={t("md.featured")}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition ${
                    item.is_featured_video
                      ? "bg-royal-50 text-royal-600"
                      : "text-slate-400 hover:bg-royal-50 hover:text-royal-600"
                  }`}
                >
                  <Star className="h-4 w-4" />
                </button>
                <button
                  onClick={() => { setEditing(item); setModalOpen(true); }}
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

        {items.length === 0 && (
          <p className="py-14 text-center text-sm text-slate-400">{t("md.noItems")}</p>
        )}
      </div>

      <MediaFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        item={editing}
        onSaved={load}
      />
    </div>
  );
}