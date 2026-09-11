"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Image, Link2, Loader2, Star, Upload, X } from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import type { Database } from "@/types/database";

type Media = Database["public"]["Tables"]["media_showcase"]["Row"];

const MAX_BYTES = 15 * 1024 * 1024;

export function MediaFormModal({
  open,
  onClose,
  item,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  item: Media | null;
  onSaved: () => void;
}) {
  const { t } = useLang();

  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<Media["media_type"]>("image");
  const [displayOrder, setDisplayOrder] = useState(0);
  const [featured, setFeatured] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(item?.title ?? "");
    setCaption(item?.caption ?? "");
    setMediaUrl(item?.media_url ?? "");
    setMediaType(item?.media_type ?? "image");
    setDisplayOrder(item?.display_order ?? 0);
    setFeatured(item?.is_featured_video ?? false);
  }, [open, item]);

  if (!open) return null;

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") && file.type !== "video/mp4") {
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
      toast.error(t("md.uploadError"));
      return;
    }
    const { data: urlData } = supabase.storage
      .from("media")
      .getPublicUrl(uploadData.path);
    setUploading(false);
    setMediaUrl(urlData.publicUrl);
    if (file.type.startsWith("image/")) setMediaType("image");
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
    const payload = {
      title: title.trim(),
      caption: caption.trim(),
      media_url: mediaUrl.trim(),
      media_type: mediaType,
      display_order: Number(displayOrder) || 0,
      is_featured_video: featured,
    };
    const { error } = item
      ? await supabase.from("media_showcase").update(payload).eq("id", item.id)
      : await supabase.from("media_showcase").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("md.saved"));
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-extrabold text-slate-900">
            {item ? t("md.edit") : t("md.add")}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              {t("md.titleField")}
            </label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              {t("md.caption")}
            </label>
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={2}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              {t("md.mediaUrl")}
            </label>
            <Input
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="https://…"
              className="font-mono text-xs"
            />
            <p className="mt-1 text-xs text-slate-400">{t("md.uploadHint")}</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/mp4"
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
              {uploading ? t("md.uploading") : t("md.upload")}
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                {t("md.type")}
              </label>
              <Select
                value={mediaType}
                onChange={(e) => setMediaType(e.target.value as Media["media_type"])}
              >
                <option value="image">{t("md.typeImage")}</option>
                <option value="video">{t("md.typeVideo")}</option>
                <option value="interview">{t("md.typeInterview")}</option>
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
              />
            </div>
          </div>

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
                <Star className={`h-4 w-4 ${featured ? "text-royal-500" : "text-slate-300"}`} />
                {t("md.featured")}
              </span>
            </span>
          </label>

          {mediaUrl && (mediaType === "image" || /youtube|youtu\.be|\.mp4/i.test(mediaUrl)) && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <Link2 className="mr-1 inline h-3 w-3" />
                {t("md.preview")}
              </p>
              <div className="flex h-32 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
                {/youtube|youtu\.be/i.test(mediaUrl) ? (
                  <span className="flex items-center gap-2 text-xs font-bold text-white/80">
                    <Image className="h-4 w-4" /> YouTube
                  </span>
                ) : /\.mp4($|\?)/i.test(mediaUrl) ? (
                  <video src={mediaUrl} muted playsInline className="h-full w-full object-contain" />
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