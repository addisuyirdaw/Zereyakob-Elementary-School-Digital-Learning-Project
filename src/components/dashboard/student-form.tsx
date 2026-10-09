"use client";

import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { X } from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { createClient } from "@/lib/supabase/client";
import { clampScore, todayInput } from "@/lib/utils";
import type { Database } from "@/types/database";

type Student = Database["public"]["Tables"]["students"]["Row"];

const defaultGrades = ["KG1", "KG2", "KG3", "1", "2", "3", "4", "5", "6", "7", "8"];

const emptyForm = {
  first_name: "",
  last_name: "",
  gender: "male",
  grade: "KG1",
  section: "A",
  status: "active",
  guardian_name: "",
  guardian_phone: "",
  address: "",
  birth_date: "",
  enrolled_at: todayInput(),
  math_score: "0",
  logic_score: "0",
  language_score: "0",
  notes: "",
};

export function StudentFormModal({
  open,
  onClose,
  student,
  onSaved,
  existingGrades = [],
}: {
  open: boolean;
  onClose: () => void;
  student: Student | null;
  onSaved: () => void;
  existingGrades?: string[];
}) {
  const { t } = useLang();
  const [form, setForm] = useState<Record<string, string>>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [isCustomGrade, setIsCustomGrade] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        student
          ? {
              first_name: student.first_name,
              last_name: student.last_name,
              gender: student.gender,
              grade: student.grade,
              section: student.section,
              status: student.status ?? "active",
              guardian_name: student.guardian_name,
              guardian_phone: student.guardian_phone,
              address: student.address,
              birth_date: student.birth_date ?? "",
              enrolled_at: student.enrolled_at.slice(0, 10),
              math_score: String(student.math_score),
              logic_score: String(student.logic_score),
              language_score: String(student.language_score),
              notes: student.notes,
            }
          : emptyForm
      );
    }
  }, [open, student]);

  if (!open) return null;

  const set = (field: string) => (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm((previous) => ({ ...previous, [field]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    if (!supabase) {
      setSaving(false);
      return;
    }
    const basePayload: Record<string, unknown> = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      gender: form.gender,
      grade: form.grade,
      section: form.section.trim(),
      guardian_name: form.guardian_name.trim(),
      guardian_phone: form.guardian_phone.trim(),
      address: form.address.trim(),
      birth_date: form.birth_date || null,
      enrolled_at: form.enrolled_at,
      math_score: clampScore(Number(form.math_score)),
      logic_score: clampScore(Number(form.logic_score)),
      language_score: clampScore(Number(form.language_score)),
      notes: form.notes.trim(),
    };

    if (form.status) {
      basePayload.status = form.status;
    }

    let result = student
      ? await supabase.from("students").update(basePayload).eq("id", student.id)
      : await supabase.from("students").insert(basePayload);

    // If status column is not yet in the remote database schema cache, retry without status
    if (result.error && (result.error.code === "PGRST204" || result.error.message?.includes("status"))) {
      delete basePayload.status;
      result = student
        ? await supabase.from("students").update(basePayload).eq("id", student.id)
        : await supabase.from("students").insert(basePayload);
    }

    setSaving(false);
    if (result.error) {
      console.error("Student save error:", result.error);
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200/60 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur">
          <h2 className="text-lg font-extrabold text-slate-900">
            {student ? t("stu.edit") : t("stu.add")}
          </h2>
          <button
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label={t("common.close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="grid gap-4 px-6 py-6 sm:grid-cols-2">
          <Input required label={t("stu.firstName")} value={form.first_name} onChange={set("first_name")} />
          <Input required label={t("stu.lastName")} value={form.last_name} onChange={set("last_name")} />
          <div className="grid grid-cols-2 gap-3">
            <Select label={t("stu.gender")} value={form.gender} onChange={set("gender")}>
              <option value="male">{t("common.male")}</option>
              <option value="female">{t("common.female")}</option>
              <option value="other">{t("common.other")}</option>
            </Select>
            <Select label={t("att.status")} value={form.status} onChange={set("status")}>
              <option value="active">Active</option>
              <option value="transferred">Transferred</option>
              <option value="graduated">Graduated</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {isCustomGrade ? (
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-slate-700">{t("stu.grade")}</label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomGrade(false);
                      if (!form.grade) setForm((p) => ({ ...p, grade: "KG1" }));
                    }}
                    className="text-[11px] text-royal-600 hover:underline font-medium"
                  >
                    ← List
                  </button>
                </div>
                <Input
                  required
                  placeholder="e.g. Pre-K, KG1, Grade 9"
                  value={form.grade}
                  onChange={set("grade")}
                />
              </div>
            ) : (
              <Select
                label={t("stu.grade")}
                value={form.grade}
                onChange={(e) => {
                  if (e.target.value === "__custom__") {
                    setIsCustomGrade(true);
                    setForm((p) => ({ ...p, grade: "" }));
                  } else {
                    set("grade")(e);
                  }
                }}
              >
                {Array.from(new Set([...defaultGrades, ...existingGrades, form.grade].filter(Boolean))).map((grade) => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                ))}
                <option value="__custom__">+ Custom Grade…</option>
              </Select>
            )}
            <Input label={t("stu.section")} value={form.section} onChange={set("section")} />
          </div>
          <Input label={t("stu.guardian")} value={form.guardian_name} onChange={set("guardian_name")} />
          <Input label={t("stu.guardianPhone")} value={form.guardian_phone} onChange={set("guardian_phone")} />
          <Input label={t("stu.address")} value={form.address} onChange={set("address")} />
          <div className="grid grid-cols-2 gap-3">
            <Input type="date" label={t("stu.birthDate")} value={form.birth_date} onChange={set("birth_date")} />
            <Input type="date" required label={t("stu.enrolledAt")} value={form.enrolled_at} onChange={set("enrolled_at")} />
          </div>
          <Input type="number" min={0} max={100} step={0.01} label={`${t("dash.math")} %`} value={form.math_score} onChange={set("math_score")} />
          <div className="grid grid-cols-2 gap-3">
            <Input type="number" min={0} max={100} step={0.01} label={`${t("dash.logic")} %`} value={form.logic_score} onChange={set("logic_score")} />
            <Input type="number" min={0} max={100} step={0.01} label={`${t("dash.language")} %`} value={form.language_score} onChange={set("language_score")} />
          </div>
          <Textarea className="sm:col-span-2" label={t("stu.notes")} value={form.notes} onChange={set("notes")} />
          <div className="flex justify-end gap-3 sm:col-span-2">
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