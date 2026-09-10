"use client";

import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { toast } from "sonner";
import { CheckCircle2, Send } from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { createClient } from "@/lib/supabase/client";

const countries = [
  "Ethiopia",
  "United States",
  "Netherlands",
  "Germany",
  "United Kingdom",
  "Canada",
  "Sweden",
  "Other",
];

export function ContactForm({ compact = false }: { compact?: boolean }) {
  const { t } = useLang();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    country: "",
    role: "supporter",
    subject: "",
    message: "",
  });

  const handleChange = (
    field: keyof typeof form
  ) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((previous) => ({ ...previous, [field]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("unconfigured");
      const { error } = await supabase.from("messages").insert(form);
      if (error) throw error;
      setDone(true);
      toast.success(t("sup.sent"));
    } catch {
      toast.error(t("common.error"));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-8 py-12 text-center">
        <CheckCircle2 className="h-12 w-12 text-emerald-600" aria-hidden />
        <p className="text-lg font-bold text-emerald-900">{t("sup.sent")}</p>
        <p className="max-w-sm text-sm text-emerald-700">
          {t("sup.contact.desc")}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className={compact ? "space-y-4" : "grid gap-4 sm:grid-cols-2"}>
        <Input
          required
          label={t("sup.name")}
          value={form.name}
          onChange={handleChange("name")}
          placeholder={t("sup.placeholder.name")}
        />
        <Input
          required
          type="email"
          label={t("sup.email")}
          value={form.email}
          onChange={handleChange("email")}
          placeholder="you@example.com"
        />
        <Select
          label={t("sup.country")}
          value={form.country}
          onChange={handleChange("country")}
        >
          <option value="">{t("common.select")}</option>
          {countries.map((country) => (
            <option key={country} value={country}>
              {country}
            </option>
          ))}
        </Select>
        <Select
          label={t("sup.role")}
          value={form.role}
          onChange={handleChange("role")}
        >
          <option value="supporter">{t("sup.role.supporter")}</option>
          <option value="partner">{t("sup.role.partner")}</option>
          <option value="media">{t("sup.role.media")}</option>
          <option value="government">{t("sup.role.government")}</option>
          <option value="other">{t("sup.role.other")}</option>
        </Select>
      </div>
      <Input
        required
        label={t("sup.subject")}
        value={form.subject}
        onChange={handleChange("subject")}
      />
      <Textarea
        required
        rows={compact ? 4 : 5}
        label={t("sup.message")}
        value={form.message}
        onChange={handleChange("message")}
      />
      <Button type="submit" loading={submitting} className="w-full">
        <Send className="h-4 w-4" aria-hidden />
        {t("sup.submit")}
      </Button>
    </form>
  );
}