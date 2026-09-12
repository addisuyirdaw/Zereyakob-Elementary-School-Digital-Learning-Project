"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Film, Image, Link2, Loader2, PlaySquare, Star, Upload, X } from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";

export type MediaItem = {
  id: string;
  title: string;
  url: string;
  type: "image" | "video";
  caption?: string;
  display_order: number;
  created_at?: string;
  is_featured_video?: boolean;
  media_url?: string;
  media_type?: string;
};

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

function youtubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/
  );
  return match?.[1] ?? null;
}

function isVideoFile(url: string): boolean {
  return /\.(mp4|webm|mov|ogg)($|\?)/i.test(url);
}

export function MediaFormModal({
  open,
  onClose,
  item,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  item: MediaItem | null;
  onSaved: () => void;
}) {
  const { t } = useLang();

  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [displayOrder, setDisplayOrder] = useState(0);
  const [featured, setFeatured] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(item?.title ?? "");
    setCaption(item?.caption ?? "");
    setMediaUrl(item?.url ?? item?.media_url ?? "");
    const rawType = item?.type ?? item?.media_type ?? "image";
    setMediaType(rawType === "video" || rawType === "interview" ? "video" : "image");
    setDisplayOrder(item?.display_order ?? 0);
    setFeatured(item?.is_featured_video ?? false);
  }, [open, item]);

  if (!open) return null;

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      toast.error(t("md.uploadError"));
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(t("md.uploadTooLarge"));
      return;
    }
    const supabase = createClient();
    if (!supabase) {
      toast.error(t("common.error"));
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() || (file.type.startsWith("image/") ? "jpg" : "mp4");
    const path = `media/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("media")
      .upload(path, file, {
        contentType: file.type,
        cacheControl: "3600",
      });
    if (uploadError) {
      setUploading(false);
      toast.error(t("md.uploadError") + ": " + uploadError.message);
      return;
    }
    const { data: urlData } = supabase.storage
      .from("media")
      .getPublicUrl(uploadData.path);
    setUploading(false);
    setMediaUrl(urlData.publicUrl);
    if (file.type.startsWith("image/")) {
      setMediaType("image");
    } else if (file.type.startsWith("video/")) {
      setMediaType("video");
    }
    toast.success(t("md.uploadSuccess"));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mediaUrl.trim()) return;
    setSaving(true);
    const supabase = createClient();
    if (!supabase) {
      setSaving(false);
      toast.error(t("common.error"));
      return;
    }

    const mediaPayload = {
      title: title.trim(),
      caption: caption.trim(),
      url: mediaUrl.trim(),
      type: mediaType,
      display_order: Number(displayOrder) || 0,
    };

    // 1. Primary write to 'media' table
    let primaryError: any = null;
    if (item?.id) {
      const res = await supabase.from("media").update(mediaPayload).eq("id", item.id);
      primaryError = res.error;
    } else {
      const res = await supabase.from("media").insert(mediaPayload);
      primaryError = res.error;
    }

    // 2. Fallback to 'media_showcase' if 'media' table failed (e.g., table not migrated yet)
    if (primaryError) {
      console.warn("Primary media table write failed, attempting media_showcase fallback:", primaryError.message);
      const showcasePayload = {
        title: title.trim(),
        caption: caption.trim(),
        media_url: mediaUrl.trim(),
        media_type: mediaType,
        display_order: Number(displayOrder) || 0,
        is_featured_video: featured,
      };
      const showcaseRes = item?.id
        ? await supabase.from("media_showcase").update(showcasePayload).eq("id", item.id)
        : await supabase.from("media_showcase").insert(showcasePayload);

      if (showcaseRes.error) {
        setSaving(false);
        toast.error(showcaseRes.error.message || primaryError.message);
        return;
      }
    } else {
      // If primary succeeded, also sync to media_showcase in background if table exists
      const showcasePayload = {
        title: title.trim(),
        caption: caption.trim(),
        media_url: mediaUrl.trim(),
        media_type: mediaType,
        display_order: Number(displayOrder) || 0,
        is_featured_video: featured,
      };
      if (item?.id) {
        supabase.from("media_showcase").update(showcasePayload).eq("id", item.id).then(() => {});
      } else {
        supabase.from("media_showcase").insert(showcasePayload).then(() => {});
      }
    }

    setSaving(false);
    toast.success(t("md.saved"));
    onSaved();
    onClose();
  };

  const yt = youtubeId(mediaUrl);
  const isVideo = mediaType === "video" || yt !== null || isVideoFile(mediaUrl);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-extrabold text-slate-900">
            {item ? t("md.edit") : t("md.add")}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4 overflow-y-auto px-6 py-5">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              {t("md.titleField")}
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Computer Lab Opening Ceremony"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                {t("md.type")}
              </label>
              <Select
                value={mediaType}
                onChange={(e) => setMediaType(e.target.value as "image" | "video")}
              >
                <option value="image">{t("md.typeImage")}</option>
                <option value="video">{t("md.typeVideo")}</option>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                {t("md.order")}
              </label>
              <Input
                type="number"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(Number(e.target.value))}
                min={0}
              />
              <p className="mt-1 text-[11px] text-slate-400">
                {t("md.displayOrderHint") || "1 = first, 2 = second..."}
              </p>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              {t("md.caption")}
            </label>
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={2}
              placeholder="A short caption or description shown on the public site..."
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              {t("md.mediaUrl")}
            </label>
            <Input
              value={mediaUrl}
              onChange={(e) => {
                const val = e.target.value;
                setMediaUrl(val);
                if (youtubeId(val) || isVideoFile(val)) {
                  setMediaType("video");
                }
              }}
              placeholder="https://… (Storage URL, YouTube, or direct video/image)"
              className="font-mono text-xs"
            />
            <p className="mt-1 text-xs text-slate-400">{t("md.uploadHint")}</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/mp4,video/webm,video/quicktime,video/*"
              className="hidden"
              onChange={onPickFile}
            />
            <button
              type="button"
              onClick={() => !uploading && fileRef.current?.click()}
              disabled={uploading || saving}
              className="mt-2 inline-flex h-10 items-center gap-2 rounded-xl border border-dashed border-royal-300 bg-royal-50/50 px-4 text-sm font-semibold text-royal-700 transition hover:border-royal-400 hover:bg-royal-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Upload className="h-4 w-4" aria-hidden />
              )}
              {uploading ? t("md.uploading") : t("md.upload")} (Max 50MB)
            </button>
          </div>

          {mediaType === "video" && (
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-sm transition ${
                featured
                  ? "border-royal-400 bg-royal-50"
                  : "border-slate-200 bg-white hover:border-royal-300"
              }`}
            >
              <input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-royal-700"
              />
              <span>
                <span className="flex items-center gap-1.5 font-bold text-slate-900">
                  <Star className={`h-4 w-4 ${featured ? "text-royal-500 fill-royal-500" : "text-slate-300"}`} />
                  {t("md.featured")}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Featured as the primary spotlight documentary on the landing page
                </span>
              </span>
            </label>
          )}

          {mediaUrl.trim() && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <Link2 className="mr-1 inline h-3 w-3" />
                {t("md.preview")}
              </p>
              <div className="relative flex h-36 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
                {yt ? (
                  <div className="relative h-full w-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://i.ytimg.com/vi/${yt}/hqdefault.jpg`}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <PlaySquare className="h-8 w-8 text-white drop-shadow" />
                    </div>
                  </div>
                ) : isVideoFile(mediaUrl) || mediaType === "video" ? (
                  <video src={mediaUrl} muted playsInline controls className="h-full w-full object-contain" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaUrl} alt="" className="h-full w-full object-contain" />
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={saving || !mediaUrl.trim()}>
              {saving ? t("common.saving") : item ? t("common.save") : t("md.add")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}