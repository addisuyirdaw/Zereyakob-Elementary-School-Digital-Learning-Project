"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CalendarCheck2,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Filter,
  History,
  Pencil,
  Search,
  UserCheck,
} from "lucide-react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { StudentFormModal } from "@/components/dashboard/student-form";
import { downloadCsv } from "@/lib/csv";
import { formatDate, initials, todayInput, toLocalDateInput } from "@/lib/utils";
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

export default function StudentDetailPage() {
  const params = useParams<{ id: string }>();
  const { t, lang } = useLang();

  const [student, setStudent] = useState<Student | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [calendarDays, setCalendarDays] = useState<SchoolCalendarDay[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  // Filter state for student's longitudinal history
  const [preset, setPreset] = useState<DateRangePreset>("last_30_days");
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return toLocalDateInput(d);
  });
  const [to, setTo] = useState(todayInput());
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    const [studentRes, attendanceRes, calendarRes, profilesRes] = await Promise.all([
      supabase.from("students").select("*").eq("id", params.id).maybeSingle(),
      supabase.from("attendance").select("*").eq("student_id", params.id).order("date", { ascending: false }),
      supabase.from("school_calendar").select("*"),
      supabase.from("profiles").select("*"),
    ]);

    setStudent(studentRes.data);
    setAttendance(attendanceRes.data ?? []);
    setCalendarDays(calendarRes.data ?? []);
    setProfiles(profilesRes.data ?? []);
    setLoading(false);
  }, [params.id]);

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

  // Filtered records for selected date range
  const inRangeRecords = useMemo(() => {
    return attendance.filter((r) => {
      const matchRange = (!from || r.date >= from) && (!to || r.date <= to);
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      return matchRange && matchStatus;
    });
  }, [attendance, from, to, statusFilter]);

  // Expected instructional days in range
  const expectedDays = useMemo(() => {
    return getExpectedSchoolDays(from, to, calendarDays);
  }, [from, to, calendarDays]);

  // Comprehensive summary calculation using standardized formula
  const summary = useMemo(() => {
    return calculateAttendanceSummary(inRangeRecords, expectedDays);
  }, [inRangeRecords, expectedDays]);

  // Overall attendance rate (All Time) for performance radar chart
  const overallSummary = useMemo(() => {
    return calculateAttendanceSummary(attendance, 0);
  }, [attendance]);

  const profileMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of profiles) {
      map.set(p.id, `${p.first_name} ${p.last_name}`.trim() || p.email);
    }
    return map;
  }, [profiles]);

  if (loading) {
    return <div className="py-24 text-center text-sm text-slate-400">{t("common.loading")}</div>;
  }

  if (!student) {
    return (
      <div className="py-24 text-center">
        <p className="text-sm text-slate-400">404</p>
        <Link href="/dashboard/students" className="mt-2 inline-block text-sm font-semibold text-royal-700 hover:underline">
          {t("stu.backToStudents")}
        </Link>
      </div>
    );
  }

  const radarData = [
    { subject: t("dash.math"), value: Number(student.math_score) },
    { subject: t("dash.logic"), value: Number(student.logic_score) },
    { subject: t("dash.language"), value: Number(student.language_score) },
    { subject: t("stu.attendanceRate"), value: overallSummary.rate ?? 0 },
  ];

  const statusTone = (status: string) =>
    status === "present" ? "green" : status === "late" ? "amber" : status === "excused" ? "royal" : "red";

  const exportStudentHistoryCsv = () => {
    const rows = inRangeRecords.map((r) => ({
      Date: r.date,
      "Student Code": student.student_code,
      Student: `${student.first_name} ${student.last_name}`,
      Grade: r.grade || student.grade,
      Section: r.section || student.section,
      Status: r.status,
      Note: r.note || "",
      "Correction Reason": r.correction_reason || "",
      "Recorded By": r.recorded_by ? profileMap.get(r.recorded_by) || r.recorded_by : "—",
      "Corrected By": r.corrected_by ? profileMap.get(r.corrected_by) || r.corrected_by : "—",
      "Recorded At": r.created_at,
    }));

    downloadCsv(`attendance-${student.student_code}-${from}-to-${to}.csv`, rows);
    toast.success(t("dir.exported"));
  };

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/students"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-royal-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t("stu.backToStudents")}
      </Link>

      {/* Header Profile Card */}
      <Card className="border-slate-200/80 shadow-sm">
        <CardContent className="px-6 py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-royal-600 to-royal-800 text-xl font-extrabold text-white shadow-glow">
                {initials(student.first_name, student.last_name)}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-extrabold text-slate-900">
                    {student.first_name} {student.last_name}
                  </h1>
                  {student.status && student.status !== "active" && (
                    <Badge tone="amber" className="capitalize">
                      {student.status}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-slate-500">
                  {student.student_code} · {t("stu.grade")} {student.grade}
                  {student.section ? ` · ${student.section}` : ""} ·{" "}
                  {student.gender === "male" ? t("common.male") : student.gender === "female" ? t("common.female") : t("common.other")}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/dashboard/khan-data?tab=students`}>
                <Button variant="outline" className="gap-2 text-royal-700 border-royal-200 hover:bg-royal-50">
                  <BookOpen className="h-4 w-4" />
                  {lang === "en" ? "Khan Analytics" : "የካን ትንተና"}
                </Button>
              </Link>
              <Button variant="outline" onClick={() => setModalOpen(true)} className="gap-2">
                <Pencil className="h-4 w-4" aria-hidden />
                {t("common.edit")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overview Grid: Performance & Profile Details */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-slate-200/80 shadow-sm">
          <CardContent className="px-6 pt-6">
            <CardTitle>{t("stu.perfTitle")}</CardTitle>
            <CardDescription>{t("stu.perfDesc")}</CardDescription>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="72%">
                  <PolarGrid stroke="#cbd5e1" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: "#334155", fontWeight: 600 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#94a3b8" }} />
                  <Radar dataKey="value" stroke="#1d4ed8" fill="#1d4ed8" fillOpacity={0.35} strokeWidth={2.5} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid rgba(226,232,240,0.9)", fontSize: 12 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              {[
                { label: t("dash.math"), value: Number(student.math_score) },
                { label: t("dash.logic"), value: Number(student.logic_score) },
                { label: t("dash.language"), value: Number(student.language_score) },
              ].map((score) => (
                <div key={score.label} className="rounded-xl bg-slate-50 px-4 py-3 text-center border border-slate-100">
                  <p className="text-xs font-medium text-slate-500">{score.label}</p>
                  <p className="text-xl font-extrabold text-slate-900">{score.value}%</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-sm">
          <CardContent className="px-6 py-6">
            <CardTitle>{t("stu.info")}</CardTitle>
            <dl className="mt-4 space-y-3 text-sm">
              {[
                [t("stu.guardian"), student.guardian_name || "—"],
                [t("stu.guardianPhone"), student.guardian_phone || "—"],
                [t("stu.address"), student.address || "—"],
                [t("stu.birthDate"), formatDate(student.birth_date, lang)],
                [t("stu.enrolledAt"), formatDate(student.enrolled_at, lang)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="text-right font-semibold text-slate-800">{value}</dd>
                </div>
              ))}
              {student.notes && (
                <div className="rounded-xl bg-amber-50 px-4 py-3 text-amber-900 text-xs border border-amber-200">
                  <span className="font-bold block mb-0.5">{t("stu.notes")}:</span>
                  {student.notes}
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* Complete Longitudinal Attendance History Section                     */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      <Card className="border-slate-200/80 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-100 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-royal-700" />
                <CardTitle>{t("att.history")}</CardTitle>
              </div>
              <CardDescription className="mt-1">
                {lang === "en"
                  ? "Longitudinal attendance logs, class transfer history, notes, and authorized corrections."
                  : "የተማሪው ሙሉ የመገኘት ታሪክ፣ የክፍል ቅያሬዎች እና ማስታወሻዎች።"}
              </CardDescription>
            </div>

            {/* Export & Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={exportStudentHistoryCsv}
                disabled={inRangeRecords.length === 0}
                className="gap-1.5 text-xs text-slate-700"
              >
                <Download className="h-3.5 w-3.5 text-royal-600" />
                {t("rep.download")}
              </Button>
            </div>
          </div>

          {/* Date Filter & Presets Bar */}
          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-4 items-end bg-slate-50/60 p-4 rounded-xl border border-slate-200/60">
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
                {t("att.status")}
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-royal-500 focus:outline-none focus:ring-2 focus:ring-royal-500/20"
              >
                <option value="all">{t("common.all")}</option>
                <option value="present">{t("att.present")}</option>
                <option value="late">{t("att.late")}</option>
                <option value="excused">{t("att.excused")}</option>
                <option value="absent">{t("att.absent")}</option>
              </select>
            </div>
          </div>

          {/* Metric Summary Cards */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 text-center">
              <p className="text-xs font-semibold text-slate-500">{t("att.rate")}</p>
              <p className="mt-1 text-2xl font-extrabold text-royal-800">
                {summary.rate !== null ? `${summary.rate}%` : "—"}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 text-center">
              <p className="text-xs font-semibold text-slate-500">{t("att.present")}</p>
              <p className="mt-1 text-2xl font-extrabold text-emerald-700">{summary.present}</p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 text-center">
              <p className="text-xs font-semibold text-slate-500">{t("att.late")}</p>
              <p className="mt-1 text-2xl font-extrabold text-amber-600">{summary.late}</p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 text-center">
              <p className="text-xs font-semibold text-slate-500">{t("att.excused")}</p>
              <p className="mt-1 text-2xl font-extrabold text-royal-700">{summary.excused}</p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 text-center">
              <p className="text-xs font-semibold text-slate-500">{t("att.absent")}</p>
              <p className="mt-1 text-2xl font-extrabold text-red-600">{summary.absent}</p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3.5 text-center">
              <p className="text-xs font-semibold text-slate-500">{t("att.unrecordedDays")}</p>
              <p className="mt-1 text-2xl font-extrabold text-slate-600">{summary.unrecordedDays}</p>
            </div>
          </div>

          {/* Incomplete Warning if days were unrecorded */}
          {!summary.isComplete && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-xs text-amber-800 border border-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              <span>
                {t("att.incompleteWarning")} ({summary.totalRecorded} {lang === "en" ? "days recorded of" : "ቀናት የተመዘገቡ ከ"} {summary.expectedSchoolDays} {lang === "en" ? "school days" : "ቀናት"}).
              </span>
            </div>
          )}

          {/* Records Table */}
          <div className="mt-5 overflow-hidden rounded-xl border border-slate-200/80">
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">{t("att.date")}</th>
                    <th className="px-4 py-3">{t("att.status")}</th>
                    <th className="px-4 py-3">{t("att.class")}</th>
                    <th className="px-4 py-3">{t("att.note")}</th>
                    <th className="px-4 py-3">{t("att.recordedBy")}</th>
                    <th className="px-4 py-3">{t("att.timestamp")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inRangeRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-royal-50/20 transition">
                      <td className="px-4 py-3 font-mono font-medium text-slate-800">
                        {record.date}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={statusTone(record.status) as "green" | "amber" | "royal" | "red"}>
                          {t(`att.${record.status}`)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                          {record.grade ? `${t("stu.grade")} ${record.grade}` : "—"}
                          {record.section ? ` · ${record.section}` : ""}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 max-w-[220px] truncate" title={record.note || record.correction_reason}>
                        {record.note ? (
                          <span className="text-slate-800 font-medium">{record.note}</span>
                        ) : record.correction_reason ? (
                          <span className="text-amber-700 italic">[{record.correction_reason}]</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {record.recorded_by ? (
                          <span>{profileMap.get(record.recorded_by) || "Staff"}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-400 font-mono">
                        {record.created_at ? record.created_at.slice(0, 16).replace("T", " ") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {inRangeRecords.length === 0 && (
              <p className="py-16 text-center text-sm text-slate-400">{t("rep.noData")}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <StudentFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        student={student}
        onSaved={() => {
          toast.success(t("stu.saved"));
          load();
        }}
      />
    </div>
  );
}