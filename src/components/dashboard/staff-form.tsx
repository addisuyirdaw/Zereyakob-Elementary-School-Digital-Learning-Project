"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

const emptyForm = {
  email: "",
  first_name: "",
  last_name: "",
  role: "teacher" as string,
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

  useEffect(() => {
    if (open) {
      setForm(
        member
          ? {
              email: member.email,
              first_name: member.first_name,
              last_name: member.last_name,
              role: member.role === "admin" || member.role === "staff" ? member.role : "teacher",
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
    const res = await fetch(member ? "/api/staff" : "/api/staff", {
      method: member ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: member?.id,
        email: form.email,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        role: form.role,
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

  const set =
    (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((previous) => ({ ...previous, [field]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200/60 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur">
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

        <form onSubmit={submit} className="space-y-4 px-6 py-6">
          <Input required type="email" label={t("sf.email")} value={form.email} onChange={set("email")} placeholder="tefla@example.com" />
          <div className="grid grid-cols-2 gap-3">
            <Input required label={t("profile.firstName")} value={form.first_name} onChange={set("first_name")} />
            <Input required label={t("profile.lastName")} value={form.last_name} onChange={set("last_name")} />
          </div>
          <Select label={t("sf.role")} value={form.role} onChange={set("role")}>
            <option value="admin">{t("role.admin")}</option>
            <option value="teacher">{t("role.teacher")}</option>
            <option value="staff">{t("role.staff")}</option>
          </Select>
          {!member && <p className="text-xs text-slate-400">{t("sf.inviteHint")}</p>}

          <div className="flex justify-end gap-3">
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