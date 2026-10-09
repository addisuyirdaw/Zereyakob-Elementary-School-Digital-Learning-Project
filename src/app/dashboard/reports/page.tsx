"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  BarChart3,
  CalendarRange,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Search,
  Users,
} from "lucide-react";
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
import { Badge, Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { downloadCsv } from "@/lib/csv";
import { todayInput, toLocalDateInput } from "@/lib/utils";
import {
  calculateAttendanceSummary,
  getDateRangeFromPreset,
  getExpectedSchoolDays,
  type AttendanceRecord,
  type DateRangePreset,
  type SchoolCalendarDay,
} from "@/lib/attendance";
import type { Database } from "@/types/database";

type Student = Database["public"]["Tables"]["students"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default function ReportsPage() {
  const { t, lang } = useLang();
  const { isStaff } = useDashboard();

  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [calendarDays, setCalendarDays] = useState<SchoolCalendarDay[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [preset, setPreset] = useState<DateRangePreset>("last_30_days");
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return toLocalDateInput(d);
  });
  const [to, setTo] = useState(todayInput());
  const [selectedGrade, setSelectedGrade] = useState<string>("all");
  const [selectedSection, setSelectedSection] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    const [studentsRes, attendanceRes, calendarRes, profilesRes] = await Promise.all([
      supabase.from("students").select("*").order("grade").order("first_name"),
      supabase.from("attendance").select("*").order("date", { ascending: true }),
      supabase.from("school_calendar").select("*"),
      supabase.from("profiles").select("*"),
    ]);

    setStudents(studentsRes.data ?? []);
    setAttendance(attendanceRes.data ?? []);
    setCalendarDays(calendarRes.data ?? []);
    setProfiles(profilesRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handlePresetChange = (nextPreset: DateRangePreset) => {
    setPreset(nextPreset);
    if (nextPreset === "custom") return;
    const { from: f, to: tDate } = getDateRangeFromPreset(nextPreset);
    setFrom(f);
    setTo(tDate);
  };

  const grades = useMemo(() => {
    return Array.from(new Set(students.map((s) => s.grade)))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [students]);

  const sections = useMemo(() => {
    const list = selectedGrade === "all" ? students : students.filter((s) => s.grade === selectedGrade);
    return Array.from(new Set(list.map((s) => s.section))).filter(Boolean).sort();
  }, [students, selectedGrade]);

  const profileMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of profiles) {
      map.set(p.id, `${p.first_name} ${p.last_name}`.trim() || p.email);
    }
    return map;
  }, [profiles]);

  // Filtered active students
  const filteredStudents = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    return students.filter((s) => {
      if (s.status && s.status !== "active") return false;
      const matchGrade = selectedGrade === "all" || s.grade === selectedGrade;
      const matchSection = selectedSection === "all" || s.section === selectedSection;
      const matchQuery =
        !needle ||
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(needle) ||
        s.student_code.toLowerCase().includes(needle);
      return matchGrade && matchSection && matchQuery;
    });
  }, [students, selectedGrade, selectedSection, searchQuery]);

  // Filtered attendance in date range & class
  const filteredStudentIds = useMemo(() => new Set(filteredStudents.map((s) => s.id)), [filteredStudents]);

  const inRangeRecords = useMemo(() => {
    return attendance.filter((a) => {
      const matchDate = (!from || a.date >= from) && (!to || a.date <= to);
      const matchStudent = filteredStudentIds.has(a.student_id);
      return matchDate && matchStudent;
    });
  }, [attendance, from, to, filteredStudentIds]);

  // Expected instructional days in range
  const expectedDays = useMemo(() => {
    return getExpectedSchoolDays(from, to, calendarDays);
  }, [from, to, calendarDays]);

  // Global summary across filtered scope
  const totalSummary = useMemo(() => {
    return calculateAttendanceSummary(inRangeRecords, expectedDays * filteredStudents.length);
  }, [inRangeRecords, expectedDays, filteredStudents.length]);

  // Daily trend aggregation
  const daily = useMemo(() => {
    const map = new Map<string, { present: number; absent: number; late: number; excused: number; total: number }>();
    for (const record of inRangeRecords) {
      const entry = map.get(record.date) ?? { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
      entry[record.status] += 1;
      entry.total += 1;
      map.set(record.date, entry);
    }

    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, counts]) => {
        const denominator = counts.present + counts.late + counts.absent;
        const rate = denominator > 0 ? Math.round(((counts.present + counts.late) / denominator) * 100) : 0;
        return {
          date,
          present: counts.present,
          absent: counts.absent,
          late: counts.late,
          excused: counts.excused,
          rate,
        };
      });
  }, [inRangeRecords]);

  // Per student breakdown
  const perStudent = useMemo(() => {
    return filteredStudents
      .map((student) => {
        const studentRecords = inRangeRecords.filter((r) => r.student_id === student.id);
        const stats = calculateAttendanceSummary(studentRecords, expectedDays);
        return {
          student,
          ...stats,
        };
      })
      .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));
  }, [filteredStudents, inRangeRecords, expectedDays]);

  // Summary CSV export
  const exportSummaryCsv = () => {
    const rows = perStudent.map((row) => ({
      "Student ID": row.student.student_code,
      Student: `${row.student.first_name} ${row.student.last_name}`,
      Grade: row.student.grade,
      Section: row.student.section,
      Present: row.present,
      Late: row.late,
      Excused: row.excused,
      Absent: row.absent,
      "Total Recorded Days": row.totalRecorded,
      "Expected School Days": row.expectedSchoolDays,
      "Unrecorded Days": row.unrecordedDays,
      "Attendance Rate": row.rate !== null ? `${row.rate}%` : "—",
      "Presence Rate": row.presenceRate !== null ? `${row.presenceRate}%` : "—",
      "From Date": from,
      "To Date": to,
    }));

    downloadCsv(`attendance-summary-${from}-to-${to}.csv`, rows);
    toast.success(t("dir.exported"));
  };

  // Detailed Daily Log CSV export
  const exportDailyLogsCsv = () => {
    const studentMap = new Map(students.map((s) => [s.id, s]));
    const rows = inRangeRecords.map((r) => {
      const stu = studentMap.get(r.student_id);
      return {
        Date: r.date,
        "Student ID": stu?.student_code ?? r.student_id,
        Student: stu ? `${stu.first_name} ${stu.last_name}` : "—",
        Grade: r.grade || stu?.grade || "",
        Section: r.section || stu?.section || "",
        Status: r.status,
        Note: r.note || "",
        "Correction Reason": r.correction_reason || "",
        "Recorded By": r.recorded_by ? profileMap.get(r.recorded_by) || r.recorded_by : "—",
        "Corrected By": r.corrected_by ? profileMap.get(r.corrected_by) || r.corrected_by : "—",
        "Timestamp": r.created_at,
      };
    });

    downloadCsv(`attendance-daily-logs-${from}-to-${to}.csv`, rows);
    toast.success(t("dir.exported"));
  };

  if (loading) {
    return <div className="py-24 text-center text-sm text-slate-400">{t("common.loading")}</div>;
  }

  const summaryCards = [
    { label: t("rep.present"), value: totalSummary.present, tone: "text-emerald-700" },
    { label: t("rep.late"), value: totalSummary.late, tone: "text-amber-600" },
    { label: t("rep.excused"), value: totalSummary.excused, tone: "text-royal-700" },
    { label: t("rep.absent"), value: totalSummary.absent, tone: "text-red-600" },
    { label: t("att.unrecordedDays"), value: totalSummary.unrecordedDays, tone: "text-slate-600" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("rep.title")}
        subtitle={t("rep.subtitle")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportSummaryCsv}
              disabled={perStudent.length === 0}
              className="gap-1.5 text-xs text-slate-700"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              {t("att.exportSummary")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportDailyLogsCsv}
              disabled={inRangeRecords.length === 0}
              className="gap-1.5 text-xs text-slate-700"
            >
              <FileText className="h-4 w-4 text-royal-600" />
              {t("att.exportLogs")}
            </Button>
          </div>
        }
      />

      {/* Filter Control Bar */}
      <Card className="border-slate-200/80 shadow-sm bg-gradient-to-br from-white to-slate-50/50">
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 items-end">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                {lang === "en" ? "Preset Range" : "የተዘጋጀ የቀን ገደብ"}
              </label>
              <select
                value={preset}
                onChange={(e) => handlePresetChange(e.target.value as DateRangePreset)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-royal-500 focus:outline-none focus:ring-2 focus:ring-royal-500/20"
              >
                <option value="last_30_days">{t("att.preset.last30Days")}</option>
                <option value="this_month">{t("att.preset.thisMonth")}</option>
                <option value="this_week">{t("att.preset.thisWeek")}</option>
                <option value="last_week">{t("att.preset.lastWeek")}</option>
                <option value="today">{t("att.preset.today")}</option>
                <option value="custom">{t("att.preset.custom")}</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                {t("rep.from")}
              </label>
              <input
                type="date"
                value={from}
                max={to}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPreset("custom");
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-royal-500 focus:outline-none focus:ring-2 focus:ring-royal-500/20"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                {t("rep.to")}
              </label>
              <input
                type="date"
                value={to}
                min={from}
                max={todayInput()}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPreset("custom");
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-royal-500 focus:outline-none focus:ring-2 focus:ring-royal-500/20"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                {t("stu.grade")}
              </label>
              <select
                value={selectedGrade}
                onChange={(e) => {
                  setSelectedGrade(e.target.value);
                  setSelectedSection("all");
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-royal-500 focus:outline-none focus:ring-2 focus:ring-royal-500/20"
              >
                <option value="all">{t("att.allClasses")}</option>
                {grades.map((g) => (
                  <option key={g} value={g}>
                    {g.toLowerCase().startsWith("kg") || g.toLowerCase().startsWith("grade") || g.toLowerCase().startsWith("pre")
                      ? g
                      : `${t("stu.grade")} ${g}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                {t("stu.section")}
              </label>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-royal-500 focus:outline-none focus:ring-2 focus:ring-royal-500/20"
              >
                <option value="all">{t("att.allSections")}</option>
                {sections.map((s) => (
                  <option key={s} value={s}>
                    {t("stu.section")} {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-xl border border-slate-200/80 bg-white p-4 text-center shadow-sm">
            <p className="text-xs font-semibold text-slate-500">{card.label}</p>
            <p className={`mt-1 text-2xl font-extrabold ${card.tone}`}>{card.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Incomplete Data Banner */}
      {!totalSummary.isComplete && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-900 border border-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <span>
            {t("att.incompleteWarning")} ({totalSummary.totalRecorded} {lang === "en" ? "total records out of" : "መዝገቦች ከ"} {totalSummary.expectedSchoolDays} {lang === "en" ? "expected student-days" : "የሚጠበቁ የተማሪ-ቀናት"}).
          </span>
        </div>
      )}

      {/* Trend Chart & Daily Breakdown */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-slate-200/80 shadow-sm">
          <CardContent className="px-6 pt-6">
            <CardTitle className="flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-royal-700" aria-hidden />
              {t("rep.summary")}
            </CardTitle>
            <CardDescription className="mt-0.5">
              {lang === "en" ? "Daily attendance rate (%) trend across selected scope" : "የየቀኑ የመገኘት መጠን"}
            </CardDescription>

            {daily.length === 0 ? (
              <p className="py-20 text-center text-sm text-slate-400">{t("common.noData")}</p>
            ) : (
              <div className="mt-4 h-72">
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

        {/* Daily Records Aggregate Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">{t("rep.date")}</h3>
            <span className="text-xs text-slate-400">{daily.length} {lang === "en" ? "active recorded dates" : "ቀናት"}</span>
          </div>
          <div className="overflow-x-auto max-h-72">
            <table className="w-full min-w-[500px] text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 sticky top-0 border-b border-slate-200/80 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                <tr>
                  <th className="px-4 py-2.5">{t("rep.date")}</th>
                  <th className="px-3 py-2.5 text-center text-emerald-700">{t("rep.present")}</th>
                  <th className="px-3 py-2.5 text-center text-amber-600">{t("rep.late")}</th>
                  <th className="px-3 py-2.5 text-center text-royal-700">{t("rep.excused")}</th>
                  <th className="px-3 py-2.5 text-center text-red-600">{t("rep.absent")}</th>
                  <th className="px-4 py-2.5 text-center font-bold">{t("att.rate")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {daily.map((day) => (
                  <tr key={day.date} className="hover:bg-royal-50/20 transition">
                    <td className="px-4 py-2 font-mono text-xs text-slate-700">{day.date}</td>
                    <td className="px-3 py-2 text-center text-emerald-700 font-medium">{day.present}</td>
                    <td className="px-3 py-2 text-center text-amber-600 font-medium">{day.late}</td>
                    <td className="px-3 py-2 text-center text-royal-700 font-medium">{day.excused}</td>
                    <td className="px-3 py-2 text-center text-red-600 font-medium">{day.absent}</td>
                    <td className="px-4 py-2 text-center font-bold text-slate-900">{day.rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* Searchable Per-Student Attendance Breakdown Table                     */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      <Card className="border-slate-200/80 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
            <div>
              <CardTitle>{t("rep.studentBreakdown")}</CardTitle>
              <CardDescription className="mt-0.5">
                {lang === "en"
                  ? "Longitudinal student attendance rates, unrecorded days, and links to detailed student profiles."
                  : "የእያንዳንዱ ተማሪ ዝርዝር የመገኘት ሁኔታ እና መጠን።"}
              </CardDescription>
            </div>

            {/* Student Search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={`${t("common.search")}…`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-700 focus:border-royal-500 focus:outline-none focus:ring-2 focus:ring-royal-500/20"
              />
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200/80">
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">{t("att.student")}</th>
                    <th className="px-4 py-3">{t("stu.grade")}</th>
                    <th className="px-3 py-3 text-center text-emerald-700">{t("att.present")}</th>
                    <th className="px-3 py-3 text-center text-amber-600">{t("att.late")}</th>
                    <th className="px-3 py-3 text-center text-royal-700">{t("att.excused")}</th>
                    <th className="px-3 py-3 text-center text-red-600">{t("att.absent")}</th>
                    <th className="px-3 py-3 text-center text-slate-500">{t("att.unrecordedDays")}</th>
                    <th className="px-4 py-3 text-center font-bold text-slate-900">{t("att.rate")}</th>
                    <th className="px-4 py-3 text-right">{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {perStudent.map((row) => (
                    <tr key={row.student.id} className="hover:bg-royal-50/20 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-royal-100 text-xs font-bold text-royal-800">
                            {row.student.first_name.charAt(0)}
                          </span>
                          <div>
                            <p className="font-semibold text-slate-900">
                              {row.student.first_name} {row.student.last_name}
                            </p>
                            <p className="text-[11px] font-mono text-slate-400">{row.student.student_code}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-xs text-slate-600">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                          {t("stu.grade")} {row.student.grade}
                          {row.student.section ? ` · ${row.student.section}` : ""}
                        </span>
                      </td>

                      <td className="px-3 py-3 text-center text-emerald-700 font-medium">{row.present}</td>
                      <td className="px-3 py-3 text-center text-amber-600 font-medium">{row.late}</td>
                      <td className="px-3 py-3 text-center text-royal-700 font-medium">{row.excused}</td>
                      <td className="px-3 py-3 text-center text-red-600 font-medium">{row.absent}</td>
                      <td className="px-3 py-3 text-center text-slate-500 font-medium">{row.unrecordedDays}</td>

                      <td className="px-4 py-3 text-center">
                        {row.rate !== null ? (
                          <Badge tone={row.rate >= 90 ? "green" : row.rate >= 70 ? "amber" : "red"}>
                            {row.rate}%
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-300 italic">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <Link href={`/dashboard/students/${row.student.id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs text-slate-500 hover:text-royal-700"
                            title={t("common.view")}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {perStudent.length === 0 && (
              <p className="py-16 text-center text-sm text-slate-400">{t("common.noData")}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}