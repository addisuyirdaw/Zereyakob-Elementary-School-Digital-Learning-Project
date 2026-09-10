"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarCheck2, CheckCheck, Save, Sparkles } from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { useDashboard } from "@/lib/dashboard-context";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { cn, initials, todayInput } from "@/lib/utils";
import type { Database } from "@/types/database";

type Student = Database["public"]["Tables"]["students"]["Row"];
type Attendance = Database["public"]["Tables"]["attendance"]["Row"];
type Status = "present" | "absent" | "late" | "excused";

const statuses: Status[] = ["present", "absent", "late", "excused"];

const statusStyles: Record<Status, string> = {
  present:
    "border-emerald-300 bg-emerald-50 text-emerald-700 hover:border-emerald-400 hover:bg-emerald-100",
  absent: "border-red-300 bg-red-50 text-red-700 hover:border-red-400 hover:bg-red-100",
  late: "border-amber-300 bg-amber-50 text-amber-700 hover:border-amber-400 hover:bg-amber-100",
  excused:
    "border-royal-300 bg-royal-50 text-royal-700 hover:border-royal-400 hover:bg-royal-100",
};

const activeStyles: Record<Status, string> = {
  present: "border-emerald-600 bg-emerald-600 text-white shadow-lg shadow-emerald-600/25",
  absent: "border-red-600 bg-red-600 text-white shadow-lg shadow-red-600/25",
  late: "border-amber-500 bg-amber-500 text-white shadow-lg shadow-amber-500/25",
  excused: "border-royal-700 bg-royal-700 text-white shadow-lg shadow-royal-700/25",
};

export default function AttendancePage() {
  const { t, lang } = useLang();
  const { user } = useDashboard();

  const [students, setStudents] = useState<Student[]>([]);
  const [date, setDate] = useState(todayInput());
  const [selections, setSelections] = useState<Record<string, Status>>({});
  const [existing, setExisting] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadStudents = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) return;
    const { data } = await supabase
      .from("students")
      .select("*")
      .order("grade")
      .order("first_name");
    setStudents(data ?? []);
  }, []);

  const loadDay = useCallback(
    async (targetDate: string) => {
      const supabase = createClient();
      if (!supabase) return;
      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("date", targetDate);
      setExisting(data ?? []);
      const next: Record<string, Status> = {};
      for (const record of data ?? []) {
        next[record.student_id] = record.status as Status;
      }
      setSelections(next);
    },
    []
  );

  useEffect(() => {
    (async () => {
      await loadStudents();
      await loadDay(todayInput());
      setLoading(false);
    })();
  }, [loadStudents, loadDay]);

  const onDateChange = (next: string) => {
    setDate(next);
    loadDay(next);
  };

  const setStatus = (studentId: string, status: Status) => {
    setSelections((previous) => ({ ...previous, [studentId]: status }));
  };

  const markAllPresent = () => {
    const next: Record<string, Status> = {};
    for (const student of students) next[student.id] = "present";
    setSelections(next);
    toast.success(t("att.markAll"));
  };

  const summary = useMemo(() => {
    const counts: Record<Status, number> = {
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
    };
    for (const student of students) {
      const status = selections[student.id] ?? "present";
      counts[status] += 1;
    }
    const recorded = counts.present + counts.late + counts.excused;
    const rate = students.length ? Math.round((recorded / students.length) * 100) : 0;
    return { ...counts, rate, total: students.length };
  }, [students, selections]);

  const save = async () => {
    setSaving(true);
    const supabase = createClient();
    if (!supabase) {
      setSaving(false);
      toast.error(t("common.error"));
      return;
    }
    const rows = students.map((student) => ({
      student_id: student.id,
      date,
      status: selections[student.id] ?? "present",
      note: "",
      recorded_by: user?.id ?? null,
    }));

    const { error } = await supabase
      .from("attendance")
      .upsert(rows, { onConflict: "student_id,date" })
      .select();

    setSaving(false);

    if (error) {
      if (String(error.code) === "23505") {
        toast.error(t("att.duplicate"));
      } else {
        toast.error(t("common.error"));
        console.error(error);
      }
      return;
    }
    toast.success(existing.some((e) => e.date === date) ? t("att.updated") : t("att.saved"));
    loadDay(date);
  };

  if (loading) {
    return <div className="py-24 text-center text-sm text-slate-400">{t("common.loading")}</div>;
  }

  return (
    <div>
      <PageHeader
        title={t("att.title")}
        subtitle={t("att.subtitle")}
        actions={
          <Button
            variant="primary"
            loading={saving}
            onClick={save}
            disabled={students.length === 0}
          >
            <Save className="h-4 w-4" aria-hidden />
            {t("att.saveAll")}
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="p-4">
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <CalendarCheck2 className="h-3.5 w-3.5" aria-hidden />
              {t("att.date")}
            </span>
            <input
              type="date"
              value={date}
              max={todayInput()}
              onChange={(e) => onDateChange(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-royal-500 focus:outline-none focus:ring-2 focus:ring-royal-500/30"
            />
          </label>
        </Card>
        {(
          [
            ["present", summary.present],
            ["absent", summary.absent],
            ["late", summary.late],
            ["excused", summary.excused],
          ] as [Status, number][]
        ).map(([status, count]) => (
          <Card key={status} className="flex items-center gap-3 p-4">
            <span className="text-2xl font-extrabold text-slate-900">{count}</span>
            <div>
              <p className="text-xs font-semibold text-slate-500">{t(`att.${status}`)}</p>
              <p className="text-[11px] text-slate-400">
                {summary.total ? Math.round((count / summary.total) * 100) : 0}%
              </p>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mb-6">
        <CardContent className="flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <p className="text-sm font-bold text-slate-700">{t("att.rate")}</p>
            <p className="text-3xl font-extrabold text-royal-800">{summary.rate}%</p>
            <Badge tone={summary.rate >= 90 ? "green" : summary.rate >= 70 ? "amber" : "red"}>
              {summary.rate}% · {t("att.preview")}
            </Badge>
          </div>
          <Button variant="outline" onClick={markAllPresent} disabled={students.length === 0}>
            <CheckCheck className="h-4 w-4" aria-hidden />
            {t("att.markAll")} — {t("att.present")}
          </Button>
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white/90 shadow-xl shadow-slate-900/5">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">{lang === "en" ? "Student" : "ተማሪ"}</th>
                <th className="px-4 py-3 font-semibold">{t("stu.grade")}</th>
                <th className="px-4 py-3 font-semibold">{t("att.status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map((student) => {
                const current = selections[student.id] ?? "present";
                return (
                  <tr key={student.id} className="transition hover:bg-royal-50/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-royal-100 text-[11px] font-bold text-royal-800">
                          {initials(student.first_name, student.last_name)}
                        </span>
                        <div>
                          <p className="font-bold text-slate-900">
                            {student.first_name} {student.last_name}
                          </p>
                          <p className="text-xs text-slate-400">{student.student_code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        {student.grade}
                        {student.section ? ` · ${student.section}` : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {statuses.map((status) => (
                          <button
                            key={status}
                            onClick={() => setStatus(student.id, status)}
                            className={cn(
                              "rounded-lg border px-3 py-1.5 text-xs font-bold transition",
                              current === status
                                ? activeStyles[status]
                                : statusStyles[status]
                            )}
                          >
                            {t(`att.${status}`)}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {students.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-slate-400">
            <Sparkles className="h-8 w-8" aria-hidden />
            <p className="text-sm">{t("common.noData")}</p>
          </div>
        )}
      </div>
    </div>
  );
}