"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  BarChart3,
  CalendarCheck2,
  GraduationCap,
  LogOut,
  Users,
} from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { LanguageToggle } from "@/components/language-toggle";
import { useDashboard } from "@/lib/dashboard-context";
import { AvatarUploader } from "@/components/dashboard/avatar-uploader";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { Database } from "@/types/database";

type Student = Database["public"]["Tables"]["students"]["Row"];
type Attendance = Database["public"]["Tables"]["attendance"]["Row"];

export default function MePage() {
  const { t, lang } = useLang();
  const { profile } = useDashboard();
  const [student, setStudent] = useState<Student | null>(null);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      if (!supabase) {
        setLoading(false);
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      setEmail(user.email ?? "");
      const studentRes = await supabase
        .from("students")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setStudent(studentRes.data ?? null);
      if (studentRes.data) {
        const attendanceRes = await supabase
          .from("attendance")
          .select("*")
          .eq("student_id", studentRes.data.id);
        if (!cancelled) setAttendance(attendanceRes.data ?? []);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = async () => {
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    window.location.href = "/";
  };

  if (loading) {
    return <div className="flex items-center justify-center py-32">{t("common.loading")}</div>;
  }

  if (!student) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <Users className="h-7 w-7" aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-extrabold text-slate-900">
          {lang === "en" ? "No learner record linked" : "የተማሪ መዝገብ አልተገናኘም"}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {lang === "en"
            ? "Ask the Super Admin to link this account to a student. You can manage your account below."
            : "ይህንን መለያ ከተማሪ ጋር ለማገናኘት ወደ ሱፐር አድሚን ይጠይቁ።"}
        </p>
      </div>
    );
  }

  const presentCount = attendance.filter((a) => a.status === "present").length;
  const rate = attendance.length
    ? Math.round((presentCount / attendance.length) * 100)
    : 0;

  const scores = [
    { key: t("stu.math"), value: Number(student.math_score) },
    { key: t("stu.logic"), value: Number(student.logic_score) },
    { key: t("stu.language"), value: Number(student.language_score) },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200/60 bg-white/70 px-4 backdrop-blur-xl sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-royal-600 to-royal-800 text-white">
            <GraduationCap className="h-5 w-5" aria-hidden />
          </span>
          <p className="text-sm font-extrabold text-slate-900">{t("brand.short")}</p>
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Card>
          <CardContent className="px-6 py-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <AvatarUploader url={profile?.avatar_url || undefined} />
                <div>
                  <h1 className="text-xl font-extrabold text-slate-900">
                    {student.first_name} {student.last_name}
                  </h1>
                  <p className="text-sm text-slate-500">
                    {student.student_code} · grade {student.grade}
                    {student.section ? ` · ${student.section}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="rounded-xl bg-royal-50 px-4 py-2.5">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-royal-700">
                    <CalendarCheck2 className="h-3.5 w-3.5" aria-hidden />
                    {t("stu.attendanceRate")}
                  </p>
                  <p className="text-2xl font-extrabold text-royal-800">{rate}%</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardContent className="px-6 pt-6">
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-royal-700" aria-hidden />
                {t("stu.perfTitle")}
              </CardTitle>
              <CardDescription>{t("stu.perfDesc")}</CardDescription>
              <div className="mt-5 space-y-4">
                {scores.map((score) => (
                  <div key={score.key}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-700">{score.key}</span>
                      <span className="font-bold text-slate-900">{score.value}%</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-royal-500 to-royal-700"
                        style={{ width: `${score.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="px-6 pt-6">
              <CardTitle>{t("stu.info")}</CardTitle>
              <dl className="mt-4 space-y-3 text-sm">
                {[
                  [t("stu.guardian"), student.guardian_name || "—"],
                  [t("stu.guardianPhone"), student.guardian_phone || "—"],
                  [t("stu.address"), student.address || "—"],
                  [t("stu.enrolledAt"), formatDate(student.enrolled_at, lang)],
                  [t("stu.birthDate"), formatDate(student.birth_date, lang)],
                  [t("auth.email"), email],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4">
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="text-right font-semibold text-slate-800">{value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}