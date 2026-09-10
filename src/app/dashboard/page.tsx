"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck2,
  ClipboardList,
  GraduationCap,
  HeartHandshake,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
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
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/layout";
import { todayInput } from "@/lib/utils";
import type { Database } from "@/types/database";

type Student = Database["public"]["Tables"]["students"]["Row"];
type Attendance = Database["public"]["Tables"]["attendance"]["Row"];

export default function OverviewPage() {
  const { t, lang } = useLang();
  const { user } = useDashboard();

  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [teacherCount, setTeacherCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      if (!supabase) {
        setLoading(false);
        return;
      }
      const [studentsRes, attendanceRes, profilesRes] = await Promise.all([
        supabase.from("students").select("*").order("grade"),
        supabase
          .from("attendance")
          .select("*")
          .gte("date", new Date(Date.now() - 31 * 86400000).toISOString().slice(0, 10))
          .order("date", { ascending: true }),
        supabase
          .from("profiles")
          .select("id")
          .in("role", ["teacher", "engineer", "admin"]),
      ]);
      if (cancelled) return;
      setStudents(studentsRes.data ?? []);
      setAttendance(attendanceRes.data ?? []);
      setTeacherCount(profilesRes.data?.length ?? 0);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const today = todayInput();
  const todays = attendance.filter((a) => a.date === today);
  const todayRate = todays.length
    ? Math.round((todays.filter((a) => a.status !== "absent").length / todays.length) * 100)
    : null;

  const avgByGrade = useMemo(() => {
    const map = new Map<string, { math: number; logic: number; lang: number; count: number }>();
    for (const s of students) {
      const entry = map.get(s.grade) ?? { math: 0, logic: 0, lang: 0, count: 0 };
      entry.math += Number(s.math_score);
      entry.logic += Number(s.logic_score);
      entry.lang += Number(s.language_score);
      entry.count += 1;
      map.set(s.grade, entry);
    }
    return [...map.entries()]
      .map(([grade, v]) => ({
        grade: `${t("stu.grade")} ${grade}`,
        math: Math.round(v.math / v.count),
        logic: Math.round(v.logic / v.count),
        lang: Math.round(v.lang / v.count),
      }))
      .sort((a, b) => a.grade.localeCompare(b.grade));
  }, [students, t]);

  const trend = useMemo(() => {
    const days: { date: string; rate: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const date = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      const records = attendance.filter((a) => a.date === date);
      days.push({
        date,
        rate: records.length
          ? Math.round((records.filter((r) => r.status !== "absent").length / records.length) * 100)
          : 0,
      });
    }
    return days;
  }, [attendance]);

  const overallAvg = students.length
    ? Math.round(
        (students.reduce((sum, s) => sum + Number(s.math_score) + Number(s.logic_score) + Number(s.language_score), 0) /
          (students.length * 3)) *
          100
      ) / 100
    : 0;

  const tooltipStyle = {
    borderRadius: 12,
    border: "1px solid rgba(226,232,240,0.9)",
    boxShadow: "0 10px 30px rgba(15,23,42,0.12)",
    fontSize: 12,
  };

  if (loading) {
    return <div className="py-24 text-center text-sm text-slate-400">{t("common.loading")}</div>;
  }

  const quickActions = [
    {
      href: "/dashboard/attendance",
      icon: <ClipboardList className="h-5 w-5" aria-hidden />,
      label: t("dash.recordAttendance"),
    },
    {
      href: "/dashboard/students",
      icon: <UserPlus className="h-5 w-5" aria-hidden />,
      label: t("dash.addStudent"),
    },
    {
      href: "/dashboard/support",
      icon: <HeartHandshake className="h-5 w-5" aria-hidden />,
      label: t("dash.manageSupport"),
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
        {t("dash.welcome")}, {user?.email?.split("@")[0]}
      </h1>
      <p className="mt-1 text-sm text-slate-500">{t("dash.subtitle")}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Users className="h-5 w-5" aria-hidden />}
          label={t("dash.totalStudents")}
          value={String(students.length)}
          accent="royal"
        />
        <StatCard
          icon={<GraduationCap className="h-5 w-5" aria-hidden />}
          label={t("dash.totalTeachers")}
          value={String(teacherCount)}
          accent="violet"
        />
        <StatCard
          icon={<CalendarCheck2 className="h-5 w-5" aria-hidden />}
          label={t("dash.todaysAttendance")}
          value={todayRate === null ? "—" : `${todayRate}%`}
          hint={todays.length ? `${todays.length} ${t("att.recorded")}` : t("dash.notRecorded")}
          accent="green"
        />
        <StatCard
          icon={<GraduationCap className="h-5 w-5" aria-hidden />}
          label={t("dash.avgScores")}
          value={`${overallAvg}%`}
          accent="amber"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="px-6 pt-6">
            <CardTitle>{t("landing.features.performance.title")}</CardTitle>
            <p className="mt-1 text-sm text-slate-500">{t("stu.perfDesc")}</p>
            {avgByGrade.length === 0 ? (
              <p className="py-16 text-center text-sm text-slate-400">{t("common.noData")}</p>
            ) : (
              <div className="mt-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={avgByGrade} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="grade" tick={{ fontSize: 11, fill: "#64748b" }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#64748b" }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <RechartsLegend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="math" name={t("dash.math")} fill="#1d4ed8" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="logic" name={t("dash.logic")} fill="#7c3aed" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="lang" name={t("dash.language")} fill="#0d9488" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="px-6 pt-6">
            <CardTitle>{t("dash.recent")}</CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              {lang === "en" ? "Attendance rate — last 14 days" : "የመገኘት መጠን — ያለፉት 14 ቀናት"}
            </p>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    tickFormatter={(value: string) => value.slice(5)}
                  />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Tooltip contentStyle={tooltipStyle} />
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
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardContent className="px-6 py-6">
            <CardTitle>{t("dash.quickActions")}</CardTitle>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {quickActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group flex items-center gap-3 rounded-xl border border-slate-200/60 bg-white p-4 transition hover:border-royal-400 hover:bg-royal-50/60"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-royal-50 text-royal-700 transition group-hover:bg-royal-700 group-hover:text-white">
                    {action.icon}
                  </span>
                  <span className="flex-1 text-sm font-bold text-slate-800">
                    {action.label}
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-royal-600" aria-hidden />
                </Link>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
              <CalendarCheck2 className="h-3.5 w-3.5" aria-hidden />
              {new Date().toLocaleDateString(lang === "am" ? "am-ET" : "en-GB", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}