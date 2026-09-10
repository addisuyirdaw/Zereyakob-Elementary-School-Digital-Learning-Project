"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Pencil } from "lucide-react";
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
import { formatDate, initials } from "@/lib/utils";
import type { Database } from "@/types/database";

type Student = Database["public"]["Tables"]["students"]["Row"];
type Attendance = Database["public"]["Tables"]["attendance"]["Row"];

export default function StudentDetailPage() {
  const params = useParams<{ id: string }>();
  const { t, lang } = useLang();

  const [student, setStudent] = useState<Student | null>(null);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const load = async () => {
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    const [studentRes, attendanceRes] = await Promise.all([
      supabase.from("students").select("*").eq("id", params.id).maybeSingle(),
      supabase.from("attendance").select("*").eq("student_id", params.id),
    ]);
    setStudent(studentRes.data);
    setAttendance(attendanceRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [params.id]);

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

  const present = attendance.filter((a) => a.status === "present").length;
  const rate = attendance.length ? Math.round((present / attendance.length) * 100) : 0;

  const radarData = [
    { subject: t("dash.math"), value: Number(student.math_score) },
    { subject: t("dash.logic"), value: Number(student.logic_score) },
    { subject: t("dash.language"), value: Number(student.language_score) },
    { subject: t("stu.attendanceRate"), value: rate },
  ];

  const statusTone = (status: string) =>
    status === "present" ? "green" : status === "late" ? "amber" : status === "excused" ? "royal" : "red";

  return (
    <div>
      <Link
        href="/dashboard/students"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-royal-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t("stu.backToStudents")}
      </Link>

      <Card>
        <CardContent className="px-6 py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-royal-600 to-royal-800 text-xl font-extrabold text-white shadow-glow">
                {initials(student.first_name, student.last_name)}
              </span>
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900">
                  {student.first_name} {student.last_name}
                </h1>
                <p className="text-sm text-slate-500">
                  {student.student_code} · {t("stu.grade")} {student.grade}
                  {student.section ? ` · ${student.section}` : ""} ·{" "}
                  {student.gender === "male" ? t("common.male") : student.gender === "female" ? t("common.female") : t("common.other")}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => setModalOpen(true)}>
              <Pencil className="h-4 w-4" aria-hidden />
              {t("common.edit")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="px-6 pt-6">
            <CardTitle>{t("stu.perfTitle")}</CardTitle>
            <CardDescription>{t("stu.perfDesc")}</CardDescription>
            <div className="mt-4 h-80">
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
                <div key={score.label} className="rounded-xl bg-slate-50 px-4 py-3">
                  <p className="text-xs font-medium text-slate-500">{score.label}</p>
                  <p className="text-xl font-extrabold text-slate-900">{score.value}%</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
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
                  <div key={label} className="flex justify-between gap-4">
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="text-right font-semibold text-slate-800">{value}</dd>
                  </div>
                ))}
                {student.notes && (
                  <div className="rounded-xl bg-amber-50 px-4 py-3 text-amber-900">{student.notes}</div>
                )}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="px-6 py-6">
              <CardTitle>{t("att.title")}</CardTitle>
              <div className="mt-3 flex items-center gap-4">
                <div className="flex-1">
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-royal-500 to-royal-700"
                      style={{ width: `${rate}%` }}
                    />
                  </div>
                </div>
                <p className="text-2xl font-extrabold text-slate-900">{rate}%</p>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {attendance.length} {t("att.recorded")} · {present}/{attendance.length} {t("att.present")}
              </p>
              {attendance.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {attendance.slice(-8).reverse().map((record) => (
                    <Badge key={record.id} tone={statusTone(record.status) as "green" | "amber" | "royal" | "red"}>
                      {formatDate(record.date, lang)} · {t(`att.${record.status}`)}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

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