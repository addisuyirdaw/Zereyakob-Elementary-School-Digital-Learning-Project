"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { KeyRound, Shield, UserCircle2 } from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { useDashboard } from "@/lib/dashboard-context";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/layout";
import { initials, formatDate } from "@/lib/utils";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default function SettingsPage() {
  const { t, lang } = useLang();
  const { user, profile, isAdmin, refreshProfile } = useDashboard();

  const [form, setForm] = useState({
    first_name: profile?.first_name ?? "",
    last_name: profile?.last_name ?? "",
    phone: profile?.phone ?? "",
    title: profile?.title ?? "",
    bio: profile?.bio ?? "",
  });
  const [savingProfile, setSavingProfile] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [members, setMembers] = useState<Profile[]>([]);

  const loadMembers = useCallback(async () => {
    if (!isAdmin) return;
    const supabase = createClient();
    if (!supabase) return;
    const { data } = await supabase.from("profiles").select("*").order("role");
    setMembers(data ?? []);
  }, [isAdmin]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    const supabase = createClient();
    if (!supabase) {
      setSavingProfile(false);
      toast.error(t("common.error"));
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update(form)
      .eq("id", user?.id ?? "");
    setSavingProfile(false);
    if (error) {
      toast.error(t("common.error"));
      return;
    }
    toast.success(t("profile.saved"));
    refreshProfile();
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error(t("auth.err.passwordShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t("auth.err.mismatch"));
      return;
    }
    setSavingPassword(true);
    const supabase = createClient();
    if (!supabase) {
      setSavingPassword(false);
      toast.error(t("common.error"));
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("profile.password.changed"));
    setNewPassword("");
    setConfirmPassword("");
  };

  const assignRole = async (member: Profile, role: Profile["role"]) => {
    const supabase = createClient();
    if (!supabase) return;
    const { error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", member.id);
    if (error) {
      toast.error(t("common.error"));
      return;
    }
    toast.success(t("profile.saved"));
    loadMembers();
  };

  const roleTone = (role: string) =>
    role === "admin" ? "violet" : role === "engineer" ? "royal" : role === "teacher" ? "green" : "slate";

  return (
    <div>
      <PageHeader title={t("profile.title")} subtitle={t("profile.subtitle")} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="px-6 pb-6 pt-6">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-royal-50 text-royal-700">
                <UserCircle2 className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <CardTitle>{t("profile.personal")}</CardTitle>
                <CardDescription>
                  {user?.email} · {t(`role.${profile?.role}`)}
                </CardDescription>
              </div>
            </div>

            <form onSubmit={saveProfile} className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  required
                  label={t("profile.firstName")}
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                />
                <Input
                  required
                  label={t("profile.lastName")}
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label={t("profile.phone")}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
                <Input
                  label={t("profile.titleField")}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <Textarea
                label={t("profile.bio")}
                rows={3}
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
              />
              <div className="flex justify-end">
                <Button type="submit" loading={savingProfile}>
                  {t("common.save")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardContent className="px-6 pb-6 pt-6">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <KeyRound className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <CardTitle>{t("profile.password.title")}</CardTitle>
                  <CardDescription>{t("profile.password.desc")}</CardDescription>
                </div>
              </div>
              <form onSubmit={changePassword} className="mt-5 space-y-4">
                <Input
                  required
                  type="password"
                  label={t("profile.password.new")}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <Input
                  required
                  type="password"
                  label={t("profile.password.confirm")}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <div className="flex justify-end">
                  <Button type="submit" loading={savingPassword} className="bg-slate-800 hover:bg-slate-700">
                    <KeyRound className="h-4 w-4" aria-hidden />
                    {t("profile.password.title")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="px-6 py-5 text-sm text-slate-500">
              <p className="font-semibold text-slate-700">{t("profile.email")}</p>
              <p className="mt-0.5">{user?.email}</p>
              <p className="mt-3 font-semibold text-slate-700">{t("profile.role")}</p>
              <p className="mt-0.5">
                <Badge tone={roleTone(profile?.role ?? "") as "violet" | "royal" | "green" | "slate"}>
                  {t(`role.${profile?.role}`)}
                </Badge>
                <span className="ml-2">
                  {user?.created_at ? `· ${t("profile.memberSince")} ${formatDate(user.created_at.slice(0, 10), lang)}` : ""}
                </span>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Admin: team role management */}
      {isAdmin && (
        <div className="mt-8">
          <div className="mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-royal-700" aria-hidden />
            <h2 className="text-lg font-extrabold text-slate-900">
              {lang === "en" ? "Team roles & permissions" : "የቡድን ሚናዎች እና ፈቃዶች"}
            </h2>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white/90 shadow-xl shadow-slate-900/5">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">{lang === "en" ? "Member" : "አባል"}</th>
                    <th className="px-4 py-3 font-semibold">{t("auth.email")}</th>
                    <th className="px-4 py-3 font-semibold">
                      {lang === "en" ? "Current role" : "የአሁኑ ሚና"}
                    </th>
                    <th className="px-4 py-3 font-semibold">{lang === "en" ? "Assign role" : "ሚና መድብ"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {members.map((member) => (
                    <tr key={member.id} className="transition hover:bg-royal-50/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-royal-100 text-[11px] font-bold text-royal-800">
                            {initials(member.first_name, member.last_name || "T")}
                          </span>
                          <span className="font-bold text-slate-900">
                            {[member.first_name, member.last_name].filter(Boolean).join(" ") || "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <div className="flex items-center gap-2">
                          {member.email}
                          {member.id === user?.id && (
                            <Badge tone="royal">{lang === "en" ? "You" : "እርስዎ"}</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={roleTone(member.role) as "violet" | "royal" | "green" | "slate"}>
                          {t(`role.${member.role}`)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {(["admin", "engineer", "teacher", "student"] as const).map((role) => (
                            <button
                              key={role}
                              disabled={member.id === user?.id}
                              onClick={() => assignRole(member, role)}
                              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                                member.role === role
                                  ? "bg-royal-700 text-white"
                                  : "bg-slate-100 text-slate-500 hover:bg-royal-50 hover:text-royal-700"
                              } disabled:cursor-not-allowed disabled:opacity-50`}
                            >
                              {role}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}