"use client";

import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Camera, Loader2, User } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { useDashboard } from "@/lib/dashboard-context";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const MAX_BYTES = 5 * 1024 * 1024;

export function AvatarUploader({
  url,
  className,
  rounded,
}: {
  url?: string;
  className?: string;
  rounded?: string;
}) {
  const { t } = useLang();
  const { user, refreshProfile } = useDashboard();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("profile.avatar.error"));
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(t("profile.avatar.tooLarge"));
      return;
    }
    const supabase = createClient();
    if (!supabase || !user) return;
    setUploading(true);
    const path = `${user.id}/avatar`;
    const { data, error } = await supabase.storage
      .from("avatars")
      .upload(path, file, {
        upsert: true,
        contentType: file.type,
        cacheControl: "3600",
      });
    if (error) {
      setUploading(false);
      toast.error(t("profile.avatar.error"));
      return;
    }
    const { data: urlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(data.path);
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ avatar_url: urlData.publicUrl })
      .eq("id", user.id);
    setUploading(false);
    if (profileError) {
      toast.error(t("common.error"));
      return;
    }
    toast.success(t("profile.avatar.saved"));
    refreshProfile();
  };

  const removeAvatar = async () => {
    const supabase = createClient();
    if (!supabase || !user) return;
    setUploading(true);
    await supabase.storage.from("avatars").remove([`${user.id}/avatar`]);
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: "" })
      .eq("id", user.id);
    setUploading(false);
    if (error) {
      toast.error(t("common.error"));
      return;
    }
    toast.success(t("profile.avatar.saved"));
    refreshProfile();
  };

  return (
    <div className={cn("group relative", className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPick}
      />

      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt="Avatar"
          className={cn(
            "h-16 w-16 rounded-2xl object-cover ring-1 ring-slate-200",
            rounded
          )}
        />
      ) : (
        <span
          className={cn(
            "flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-royal-600 to-royal-800 text-white ring-1 ring-white/10",
            rounded
          )}
        >
          <User className="h-7 w-7" aria-hidden />
        </span>
      )}

      <div
        className={cn(
          "absolute inset-0 flex cursor-pointer items-center justify-center rounded-2xl bg-slate-900/0 text-transparent opacity-0 transition group-hover:bg-slate-900/50 group-hover:text-white group-hover:opacity-100",
          rounded
        )}
        onClick={() => !uploading && inputRef.current?.click()}
        role="button"
        aria-label={t("profile.avatar.change")}
      >
        {uploading ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        ) : (
          <Camera className="h-5 w-5" aria-hidden />
        )}
      </div>

      {url && !uploading && (
        <button
          onClick={removeAvatar}
          className="absolute rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-red-600 shadow-sm ring-1 ring-red-200"
          style={{ bottom: "-0.375rem", right: "-0.375rem" }}
          title={t("profile.avatar.remove")}
        >
          ✕
        </button>
      )}
    </div>
  );
}