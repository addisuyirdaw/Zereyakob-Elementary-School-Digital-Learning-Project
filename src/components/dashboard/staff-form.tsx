"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Image as ImageIcon, Loader2, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

const emptyForm = {
  email: "",
  first_name: "",
  last_name: "",
  role: "teacher" as string,
  profession: "",
  bio: "",
  avatar_url: "",
  is_public: false,
};

export function StaffFormModal({
  open,
  onClose,
  member,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  member: Profile | null;
  onSaved: () => void;
}) {
  const { t } = useLang();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setForm(
        member
          ? {
              email: member.email,
              first_name: member.first_name,
              last_name: member.last_name,
              role: member.role === "admin" || member.role === "staff" ? member.role : "teacher",
              profession: member.profession,
              bio: member.bio,
              avatar_url: member.avatar_url,
              is_public: member.is_public,
            }
          : emptyForm
      );
    }
  }, [open, member]);

  if (!open) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.email.includes("@")) {
      toast.error(t("auth.err.emailInvalid"));
      return;
    }
    setSaving(true);
    const res = await fetch("/api/staff", {
      method: member ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: member?.id,
        email: form.email,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        role: form.role,
        profession: form.profession.trim(),
        bio: form.bio.trim(),
        avatar_url: form.avatar_url.trim(),
        is_public: form.is_public,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      if (data?.code === "missing_secret") {
        toast.error(t("sf.requiresSecret"));
      } else {
        toast.error(data?.message ?? t("common.error"));
      }
      return;
    }
    toast.success(t("sf.saved"));
    onSaved();
    onClose();
  };

  const photoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("sf.photoError"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("sf.photoTooLarge"));
      return;
    }
    const supabase = createClient();
    if (!supabase) return;
    setUploading(true);
    const emailKey = (form.email || "new").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "new";
    const path = member ? `staff/${member.id}/photo` : `staff/${Date.now()}-${emailKey}/photo`;
    const { data, error } = await supabase.storage.from("avatars").upload(path, file, {
      upsert: true,
      contentType: file.type,
      cacheControl: "3600",
    });
    if (error || !data) {
      setUploading(false);
      toast.error(t("sf.photoError"));
      return;
    }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(data.path);
    setForm((previous) => ({ ...previous, avatar_url: urlData.publicUrl }));
    setUploading(false);
    toast.success(t("sf.photoSaved"));
  };

  const set =
    (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((previous) => ({ ...previous, [field]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-extrabold text-slate-900">
            {member ? t("sf.edit") : t("sf.add")}
          </h2>
          <button
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label={t("common.close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4 overflow-y-auto px-6 py-6">
          <Input required type="email" label={t("sf.email")} value={form.email} onChange={set("email")} placeholder="tefla@example.com" />
          <div className="grid grid-cols-2 gap-3">
            <Input required label={t("profile.firstName")} value={form.first_name} onChange={set("first_name")} />
            <Input required label={t("profile.lastName")} value={form.last_name} onChange={set("last_name")} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label={t("sf.role")} value={form.role} onChange={set("role")}>
              <option value="admin">{t("role.admin")}</option>
              <option value="teacher">{t("role.teacher")}</option>
              <option value="staff">{t("role.staff")}</option>
            </Select>
            <Input label={t("sf.profession")} value={form.profession} onChange={set("profession")} placeholder="Lead Learning Engineer" />
          </div>
          <Textarea label={t("sf.bio")} value={form.bio} onChange={set("bio")} rows={3} />

          <div>
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">
              {t("sf.photo")}
            </span>
            <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-royal-600" aria-hidden />
                ) : form.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex flex-col items-center gap-1 text-slate-300">
                    <ImageIcon className="h-6 w-6" aria-hidden />
                    <span className="px-1 text-[10px] font-semibold uppercase tracking-wide">
                      {t("sf.photo")}
                    </span>
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  <UploadCloud className="h-4 w-4" aria-hidden />
                  {uploading ? t("sf.photoUploading") : t("sf.photoUpload")}
                </Button>
                <p className="mt-1.5 text-xs text-slate-400">{t("sf.photoHint")}</p>
                {form.avatar_url && !uploading && (
                  <button
                    type="button"
                    onClick={() => setForm((previous) => ({ ...previous, avatar_url: "" }))}
                    className="mt-1 text-xs font-semibold text-red-600 transition hover:text-red-700"
                  >
                    {t("sf.photoRemove")}
                  </button>
                )}
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={photoUpload}
            />
          </div>
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-sm transition ${
              form.is_public
                ? "border-royal-400 bg-royal-50"
                : "border-slate-200 bg-white hover:border-royal-300"
            }`}
          >
            <input
              type="checkbox"
              checked={form.is_public}
              onChange={(e) => setForm((previous) => ({ ...previous, is_public: e.target.checked }))}
              className="mt-0.5 h-4 w-4 accent-royal-700"
            />
            <span>
              <span className="font-bold text-slate-900">{t("sf.publish")}</span>
              <span className="mt-0.5 block text-xs text-slate-500">{t("sf.publishHint")}</span>
            </span>
          </label>
          {!member && <p className="text-xs text-slate-400">{t("sf.inviteHint")}</p>}

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={saving}>
              {t("common.save")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}