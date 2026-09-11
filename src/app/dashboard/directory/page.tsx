"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarRange, Download, Search } from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { downloadCsv } from "@/lib/csv";
import { cn, initials } from "@/lib/utils";
import type { Database } from "@/types/database";

type Student = Database["public"]["Tables"]["students"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Attendance = Database["public"]["Tables"]["attendance"]["Row"];

type Tab = "students" | "teachers" | "team" | "attendance";

export default function DirectoryPage() {
  const { t, lang } = useLang();
  const [tab, setTab] = useState<Tab>("students");
  const [students, setStudents] = useState<Student[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    const [studentsRes, profilesRes, attendanceRes] = await Promise.all([
      supabase.from("students").select("*"),
      supabase.from("profiles").select("*"),
      supabase.from("attendance").select("*"),
    ]);
    setStudents(studentsRes.data ?? []);
    setProfiles(profilesRes.data ?? []);
    setAttendance(attendanceRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const teachers = useMemo(
    () => profiles.filter((p) => p.role === "teacher"),
    [profiles]
  );
  const team = useMemo(
    () =>
      profiles.filter(
        (p) =>
          p.role === "admin" ||
          p.role === "super_admin" ||
          p.role === "staff"
      ),
    [profiles]
  );

  const needle = query.trim().toLowerCase();

  const filteredStudents = students.filter((s) =>
    !needle ||
    `${s.first_name} ${s.last_name}`.toLowerCase().includes(needle) ||
    s.student_code.toLowerCase().includes(needle) ||
    `${s.grade} ${s.section}`.toLowerCase().includes(needle)
  );

  const filteredProfiles = (list: Profile[]) =>
    list.filter(
      (p) =>
        !needle ||
        `${p.first_name} ${p.last_name} ${p.email}`.toLowerCase().includes(needle) ||
        p.title.toLowerCase().includes(needle)
    );

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "students", label: t("dash.students"), count: students.length },
    { key: "teachers", label: t("role.teacher"), count: teachers.length },
    { key: "team", label: t("role.team"), count: team.length },
    { key: "attendance", label: t("att.title"), count: attendance.length },
  ];

  const exportStudents = () => {
    downloadCsv(
      `zereyakob-students-${new Date().toISOString().slice(0, 10)}.csv`,
      filteredStudents.map((s) => ({
        ID: s.student_code,
        "First name": s.first_name,
        "Last name": s.last_name,
        Gender: s.gender,
        Grade: s.grade,
        Section: s.section,
        Guardian: s.guardian_name,
        "Guardian phone": s.guardian_phone,
        Address: s.address,
        "Math score": `${s.math_score}%`,
        "Logic score": `${s.logic_score}%`,
        "Language score": `${s.language_score}%`,
        Enrolled: s.enrolled_at,
      }))
    );
    toast.success(t("dir.exported"));
  };

  const exportProfiles = (list: Profile[], kind: string) => {
    downloadCsv(
      `zereyakob-${kind}-${new Date().toISOString().slice(0, 10)}.csv`,
      list.map((p) => ({
        "First name": p.first_name,
        "Last name": p.last_name,
        Email: p.email,
        Role: p.role,
        Title: p.title,
        Phone: p.phone,
      }))
    );
    toast.success(t("dir.exported"));
  };

  const exportAttendance = () => {
    const studentById = new Map(students.map((s) => [s.id, s]));
    downloadCsv(
      `zereyakob-attendance-${new Date().toISOString().slice(0, 10)}.csv`,
      attendance.map((a) => {
        const student = studentById.get(a.student_id);
        return {
          Date: a.date,
          "Student ID": student?.student_code ?? a.student_id,
          Student: student ? `${student.first_name} ${student.last_name}` : "",
          Status: a.status,
        };
      })
    );
    toast.success(t("dir.exported"));
  };

  if (loading) {
    return <div className="py-24 text-center text-sm text-slate-400">{t("common.loading")}</div>;
  }

  const roleTone = (role: string) =>
    role === "super_admin" || role === "admin"
      ? "violet"
      : role === "staff"
        ? "royal"
        : "green";

  return (
    <div>
      <PageHeader
        title={t("dir.title")}
        subtitle={t("dir.subtitle")}
        actions={[
          <Button
            key="export"
            variant="outline"
            onClick={() => {
              if (tab === "students") exportStudents();
              else if (tab === "teachers") exportProfiles(teachers, "teachers");
              else if (tab === "team") exportProfiles(team, "team");
              else exportAttendance();
            }}
          >
            <Download className="h-4 w-4" aria-hidden />
            {t("dir.exportCsv")}
          </Button>,
          <Button key="att-export" variant="subtle" onClick={exportAttendance}>
            <CalendarRange className="h-4 w-4" aria-hidden />
            {t("dir.exportAtt")}
          </Button>,
        ]}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5 rounded-2xl border border-slate-200/60 bg-white p-1.5">
          {tabs.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition",
                tab === item.key
                  ? "bg-royal-700 text-white shadow-lg shadow-royal-700/25"
                  : "text-slate-600 hover:bg-royal-50 hover:text-royal-700"
              )}
            >
              {item.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                  tab === item.key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                )}
              >
                {item.count}
              </span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`${t("common.search")}…`}
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm shadow-sm focus:border-royal-500 focus:outline-none focus:ring-2 focus:ring-royal-500/30 sm:w-64"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white/90 shadow-xl shadow-slate-900/5">
        <div className="overflow-x-auto">
          {tab === "students" && (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">{lang === "en" ? "Student" : "ተማሪ"}</th>
                  <th className="px-4 py-3 font-semibold">{t("stu.code")}</th>
                  <th className="px-4 py-3 font-semibold">{t("stu.grade")}</th>
                  <th className="px-4 py-3 font-semibold">{t("stu.guardian")}</th>
                  <th className="hidden px-4 py-3 font-semibold sm:table-cell">{t("stu.guardianPhone")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((s) => (
                  <tr key={s.id} className="transition hover:bg-royal-50/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-royal-100 text-[11px] font-bold text-royal-800">
                          {initials(s.first_name, s.last_name)}
                        </span>
                        <span className="font-bold text-slate-900">
                          {s.first_name} {s.last_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{s.student_code}</td>
                    <td className="px-4 py-3">
                      <Badge>{`${t("stu.grade")} ${s.grade}${s.section ? ` · ${s.section}` : ""}`}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{s.guardian_name || "—"}</td>
                    <td className="hidden px-4 py-3 text-slate-600 sm:table-cell">{s.guardian_phone || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === "teachers" && (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">{lang === "en" ? "Teacher" : "መምህር"}</th>
                  <th className="px-4 py-3 font-semibold">{t("auth.email")}</th>
                  <th className="px-4 py-3 font-semibold">{t("profile.titleField")}</th>
                  <th className="px-4 py-3 font-semibold">{t("profile.phone")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProfiles(teachers).map((p) => (
                  <tr key={p.id} className="transition hover:bg-royal-50/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-[11px] font-bold text-violet-800">
                          {initials(p.first_name, p.last_name || "T")}
                        </span>
                        <div>
                          <p className="font-bold text-slate-900">
                            {[p.first_name, p.last_name].filter(Boolean).join(" ") || "—"}
                          </p>
                          <Badge tone="green">{t("role.teacher")}</Badge>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.email}</td>
                    <td className="px-4 py-3 text-slate-600">{p.title || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{p.phone || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === "team" && (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">{lang === "en" ? "Member" : "አባል"}</th>
                  <th className="px-4 py-3 font-semibold">{t("auth.email")}</th>
                  <th className="px-4 py-3 font-semibold">{t("dir.role")}</th>
                  <th className="px-4 py-3 font-semibold">{t("profile.titleField")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProfiles(team).map((p) => (
                  <tr key={p.id} className="transition hover:bg-royal-50/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-royal-100 text-[11px] font-bold text-royal-800">
                          {initials(p.first_name, p.last_name || "T")}
                        </span>
                        <p className="font-bold text-slate-900">
                          {[p.first_name, p.last_name].filter(Boolean).join(" ") || "—"}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.email}</td>
                    <td className="px-4 py-3">
                      <Badge tone={roleTone(p.role) as "violet" | "royal" | "green"}>
                        {t(`role.${p.role}`)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.title || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === "attendance" && (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">{t("rep.date")}</th>
                  <th className="px-4 py-3 font-semibold">{lang === "en" ? "Student" : "ተማሪ"}</th>
                  <th className="px-4 py-3 font-semibold">{t("att.status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attendance
                  .slice()
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .slice(0, 300)
                  .map((a) => {
                    const student = students.find((s) => s.id === a.student_id);
                    return (
                      <tr key={a.id} className="transition hover:bg-royal-50/30">
                        <td className="px-4 py-3 font-medium text-slate-600">{a.date}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {student ? `${student.first_name} ${student.last_name}` : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={a.status === "present" ? "green" : a.status === "late" ? "amber" : a.status === "excused" ? "royal" : "red"}>
                            {t(`att.${a.status}`)}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}