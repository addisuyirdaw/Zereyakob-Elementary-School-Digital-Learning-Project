"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { useDashboard } from "@/lib/dashboard-context";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/field";
import type { Database } from "@/types/database";

type Partner = Database["public"]["Tables"]["partners"]["Row"];

const emptyForm = {
  name: "",
  slug: "",
  website: "",
  logo_url: "",
  description_en: "",
  description_am: "",
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export function PartnersPanel() {
  const { t, lang } = useLang();
  const { isAdmin } = useDashboard();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setLoaded(true);
      return;
    }
    const { data } = await supabase
      .from("partners")
      .select("*")
      .order("sort_order")
      .order("name");
    setPartners(data ?? []);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleActive = async (partner: Partner) => {
    const supabase = createClient();
    if (!supabase) return;
    const { error } = await supabase
      .from("partners")
      .update({ is_active: !partner.is_active })
      .eq("id", partner.id);
    if (error) {
      toast.error(t("common.error"));
      return;
    }
    load();
  };

  const remove = async (partner: Partner) => {
    if (!window.confirm(`${t("common.deleteConfirm")}: ${partner.name}?`)) return;
    const supabase = createClient();
    if (!supabase) return;
    const { error } = await supabase
      .from("partners")
      .delete()
      .eq("id", partner.id);
    if (error) {
      toast.error(t("common.error"));
      return;
    }
    toast.success(t("partners.manage.deleted"));
    load();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    if (!supabase) {
      setSaving(false);
      toast.error(t("common.error"));
      return;
    }
    const { error } = await supabase.from("partners").insert({
      name: form.name.trim(),
      slug: form.slug.trim() || slugify(form.name.trim()),
      website: form.website.trim(),
      logo_url: form.logo_url.trim(),
      description_en: form.description_en.trim(),
      description_am: form.description_am.trim(),
      sort_order:
        partners.length > 0
          ? Math.max(...partners.map((p) => p.sort_order)) + 1
          : 0,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message.includes("duplicate") ? error.message : t("common.error"));
      return;
    }
    toast.success(t("partners.manage.saved"));
    setForm(emptyForm);
    setShowForm(false);
    load();
  };

  return (
    <div className="mt-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-royal-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-royal-700">
            {t("partners.managedBy")}
          </span>
        </div>
        <Button variant="outline" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" aria-hidden />
          {t("partners.manage.add")}
        </Button>
      </div>

      {showForm && (
        <form
          onSubmit={submit}
          className="mb-6 grid gap-4 rounded-2xl border border-slate-200/60 bg-white/90 p-6 shadow-xl shadow-slate-900/5 sm:grid-cols-2"
        >
          <Input
            required
            label={t("partners.manage.name")}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Oxfam Novib"
          />
          <Input
            label={t("partners.manage.slug")}
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            placeholder={slugify(form.name) || "auto"}
          />
          <Input
            label={t("partners.manage.website")}
            value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
            placeholder="https://example.org"
          />
          <Input
            label={t("partners.manage.logo")}
            value={form.logo_url}
            onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
            placeholder="https://…/logo.png"
          />
          <Textarea
            className="sm:col-span-2"
            label={t("partners.manage.descEn")}
            rows={2}
            value={form.description_en}
            onChange={(e) => setForm({ ...form, description_en: e.target.value })}
          />
          <Textarea
            className="sm:col-span-2"
            label={t("partners.manage.descAm")}
            rows={2}
            value={form.description_am}
            onChange={(e) => setForm({ ...form, description_am: e.target.value })}
          />
          <div className="flex justify-end gap-3 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={saving}>
              {t("common.save")}
            </Button>
          </div>
        </form>
      )}

      {!loaded ? (
        <p className="py-8 text-center text-sm text-slate-400">{t("common.loading")}</p>
      ) : partners.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">{t("common.noData")}</p>
      ) : (
        <div className="space-y-3">
          {partners.map((partner) => (
            <div
              key={partner.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/60 bg-white/90 px-5 py-4 shadow-xl shadow-slate-900/5"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-royal-600 to-royal-800 text-xs font-extrabold text-white">
                {partner.name.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900">{partner.name}</p>
                <p className="truncate text-xs text-slate-400">
                  {partner.website || partner.slug}
                  {partner.logo_url ? " · logo" : ""}
                </p>
              </div>
              <button
                onClick={() => toggleActive(partner)}
                className="inline-flex items-center gap-2"
                title={t("partners.manage.visible")}
              >
                <Badge tone={partner.is_active ? "green" : "slate"}>
                  {partner.is_active
                    ? lang === "en"
                      ? "Visible"
                      : "ይታያል"
                    : lang === "en"
                      ? "Hidden"
                      : "ተደብቋል"}
                </Badge>
              </button>
              {isAdmin && (
                <button
                  onClick={() => remove(partner)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                  title={t("common.delete")}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}