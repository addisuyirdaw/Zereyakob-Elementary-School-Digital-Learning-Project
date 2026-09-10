"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarRange, Download } from "lucide-react";
import {
  CartesianGrid,
  Legend as RechartsLegend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { useDashboard } from "@/lib/dashboard-context";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/layout";
import { downloadCsv } from "@/lib/csv";
import { todayInput, toLocalDateInput } from "@/lib/utils";
import type { Database } from "@/types/database";

type Student = Database["public"]["Tables"]["students"]["Row"];
type Attendance = Database["public"]["Tables"]["attendance"]["Row"];

export default function ReportsPage() {
  const { t, lang } = useLang();
  const { isAdmin } = useDashboard();

  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [from, setFrom] = useState(() => {
    const date = new Date(Date.now() - 13 * 86400000);
    return toLocalDateInput(date);
  });
  const [to, setTo] = useState(todayInput());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    const [studentsRes, attendanceRes] = await Promise.all([
      supabase.from("students").select("*"),
      supabase.from("attendance").select("*").order("date", { ascending: true }),
    ]);
    setStudents(studentsRes.data ?? []);
    setAttendance(attendanceRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const inRange = useMemo(
    () => attendance.filter((a) => a.date >= from && a.date <= to),
    [attendance, from, to]
  );

  const daily = useMemo(() => {
    const map = new Map<string, { present: number; absent: number; late: number; excused: number; total: number }>();
    for (const record of inRange) {
      const entry = map.get(record.date) ?? { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
      entry[record.status] += 1;
      entry.total += 1;
      map.set(record.date, entry);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, counts]) => ({
        date,
        present: counts.present,
        absent: counts.absent,
        late: counts.late,
        excused: counts.excused,
        rate: counts.total
          ? Math.round(((counts.present + counts.late + counts.excused) / counts.total) * 100)
          : 0,
      }));
  }, [inRange]);

  const perStudent = useMemo(() => {
    return students
      .map((student) => {
        const records = inRange.filter((r) => r.student_id === student.id);
        const present = records.filter((r) => r.status === "present").length;
        const late = records.filter((r) => r.status === "late").length;
        const excused = records.filter((r) => r.status === "excused").length;
        const absent = records.filter((r) => r.status === "absent").length;
        return {
          student,
          present,
          late,
          excused,
          absent,
          rate: records.length
            ? Math.round(((present + late + excused) / records.length) * 100)
            : null,
        };
      })
      .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));
  }, [students, inRange]);

  const totals = useMemo(
    () =>
      daily.reduce(
        (acc, day) => ({
          present: acc.present + day.present,
          absent: acc.absent + day.absent,
          late: acc.late + day.late,
          excused: acc.excused + day.excused,
        }),
        { present: 0, absent: 0, late: 0, excused: 0 }
      ),
    [daily]
  );

  const exportCsv = () => {
    const rows = perStudent.flatMap((row) =>
      row.rate === null
        ? []
        : [
            {
              Student: `${row.student.first_name} ${row.student.last_name}`,
              "Student ID": row.student.student_code,
              Grade: row.student.grade,
              Present: row.present,
              Late: row.late,
              Excused: row.excused,
              Absent: row.absent,
              Total: row.present + row.late + row.excused + row.absent,
              "Attendance rate": `${row.rate}%`,
              From: from,
              To: to,
            },
          ]
    );
    downloadCsv(`zereyakob-attendance-report-${from}-to-${to}.csv`, rows);
    toast.success(t("dir.exported"));
  };

  if (loading) {
    return <div className="py-24 text-center text-sm text-slate-400">{t("common.loading")}</div>;
  }

  const summaryCards = [
    { label: t("rep.present"), value: totals.present, tone: "text-emerald-600" },
    { label: t("rep.late"), value: totals.late, tone: "text-amber-500" },
    { label: t("rep.excused"), value: totals.excused, tone: "text-royal-600" },
    { label: t("rep.absent"), value: totals.absent, tone: "text-red-600" },
  ];

  return (
    <div>
      <PageHeader
        title={t("rep.title")}
        subtitle={t("rep.subtitle")}
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={perStudent.length === 0}>
            <Download className="h-4 w-4" aria-hidden />
            {t("rep.download")}
          </Button>
        }
      />

      <Card className="mb-6">
        <CardContent className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-end">
          <Input
            type="date"
            label={t("rep.from")}
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
          />
          <Input
            type="date"
            label={t("rep.to")}
            value={to}
            min={from}
            max={todayInput()}
            onChange={(e) => setTo(e.target.value)}
          />
          <div className="flex flex-1 gap-4">
            {summaryCards.map((card) => (
              <div key={card.label} className="flex-1 rounded-xl bg-slate-50 px-4 py-3 text-center">
                <p className="text-xs font-medium text-slate-500">{card.label}</p>
                <p className={`text-xl font-extrabold ${card.tone}`}>{card.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="px-6 pt-6">
            <CardTitle className="flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-royal-700" aria-hidden />
              {t("rep.summary")}
            </CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              {lang === "en"
                ? "Daily counts — daily present rate line"
                : "የየቀኑ ቆጠራ — የየቀኑ የመገኘት መጠን"}
            </p>
            {daily.length === 0 ? (
              <p className="py-16 text-center text-sm text-slate-400">{t("common.noData")}</p>
            ) : (
              <div className="mt-4 h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={daily} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748b" }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#64748b" }} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid rgba(226,232,240,0.9)", fontSize: 12 }} />
                    <RechartsLegend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey="rate"
                      name={`${t("att.rate")} %`}
                      stroke="#1d4ed8"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "#1d4ed8" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white/90 shadow-xl shadow-slate-900/5">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">{t("rep.date")}</th>
                  <th className="px-4 py-3 text-center font-semibold">{t("rep.present")}</th>
                  <th className="px-4 py-3 text-center font-semibold">{t("rep.late")}</th>
                  <th className="px-4 py-3 text-center font-semibold">{t("rep.excused")}</th>
                  <th className="px-4 py-3 text-center font-semibold">{t("rep.absent")}</th>
                  <th className="px-4 py-3 text-center font-semibold">{t("att.rate")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {daily.map((day) => (
                  <tr key={day.date} className="transition hover:bg-royal-50/30">
                    <td className="px-4 py-2.5 font-medium text-slate-600">{day.date}</td>
                    <td className="px-4 py-2.5 text-center text-emerald-700">{day.present}</td>
                    <td className="px-4 py-2.5 text-center text-amber-600">{day.late}</td>
                    <td className="px-4 py-2.5 text-center text-royal-700">{day.excused}</td>
                    <td className="px-4 py-2.5 text-center text-red-600">{day.absent}</td>
                    <td className="px-4 py-2.5 text-center font-bold text-slate-900">{day.rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isAdmin && perStudent.length > 0 && (
            <div className="border-t border-slate-100 px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("att.rate")} — {lang === "en" ? "per student" : "በተማሪ"}
              </p>
              <ul className="mt-3 space-y-2">
                {perStudent.slice(0, 12).map((row) => (
                  <li key={row.student.id} className="flex items-center gap-3 text-sm">
                    <span className="w-44 truncate font-semibold text-slate-800">
                      {row.student.first_name} {row.student.last_name}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-royal-500 to-royal-700"
                        style={{ width: `${row.rate ?? 0}%` }}
                      />
                    </div>
                    <span className="w-12 text-right font-bold text-slate-900">{row.rate}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}