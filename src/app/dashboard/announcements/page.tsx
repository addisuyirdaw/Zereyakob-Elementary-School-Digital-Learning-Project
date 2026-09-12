"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Mail,
  Megaphone,
  RefreshCw,
  Send,
  Users,
  Zap,
} from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { useDashboard } from "@/lib/dashboard-context";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/layout";
import { Badge } from "@/components/ui/card";

interface Recipient {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
}

const ANNOUNCEMENT_TYPES = [
  { value: "Platform Update", label: "🚀 Platform Update", labelAm: "🚀 የፕላትፎርም ዝማኔ" },
  { value: "New Feature", label: "✨ New Feature", labelAm: "✨ አዲስ ባህሪ" },
  { value: "Media Update", label: "🖼️ Media & Gallery Update", labelAm: "🖼️ ሚዲያ እና ጋለሪ ዝማኔ" },
  { value: "System Announcement", label: "📢 System Announcement", labelAm: "📢 የስርዓት ማስታወቂያ" },
  { value: "Staff Notice", label: "📋 Staff Notice", labelAm: "📋 የሰራተኛ ማስታወቂያ" },
  { value: "Security Update", label: "🔒 Security Update", labelAm: "🔒 የደህንነት ዝማኔ" },
];

const TARGET_ROLE_OPTIONS = [
  { value: "all", label: "All Staff & Admins", labelAm: "ሁሉም ሰራተኞች እና አድሚኖች" },
  { value: "admins_only", label: "Admins & Super Admins only", labelAm: "አድሚኖች እና ሱፐር አድሚኖች ብቻ" },
  { value: "teachers_only", label: "Teachers only", labelAm: "መምህራን ብቻ" },
];

function roleBadgeProps(role: string): { tone: "royal" | "green" | "amber" | "violet" } {
  if (role === "super_admin") return { tone: "violet" };
  if (role === "admin") return { tone: "royal" };
  if (role === "teacher") return { tone: "green" };
  return { tone: "amber" };
}

function formatRole(role: string): string {
  return role.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export default function AnnouncementsPage() {
  const { lang } = useLang();
  const { isSuperAdmin } = useDashboard();

  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(true);
  const [showRecipients, setShowRecipients] = useState(false);
  const [targetRoles, setTargetRoles] = useState("all");
  const [announcementType, setAnnouncementType] = useState("Platform Update");
  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [actionUrl, setActionUrl] = useState("");
  const [actionLabel, setActionLabel] = useState("");
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<{
    sent: number;
    failed: number;
    total: number;
    provider: string;
  } | null>(null);

  const loadRecipients = useCallback(async () => {
    setLoadingRecipients(true);
    try {
      const res = await fetch("/api/broadcast");
      const data = await res.json().catch(() => ({}));
      if (res.ok) setRecipients(data.recipients ?? []);
    } finally {
      setLoadingRecipients(false);
    }
  }, []);

  useEffect(() => {
    loadRecipients();
  }, [loadRecipients]);

  const filteredRecipients = recipients.filter((r) => {
    if (targetRoles === "admins_only") return r.role === "admin" || r.role === "super_admin";
    if (targetRoles === "teachers_only") return r.role === "teacher";
    return true;
  });

  const resolvedRoles =
    targetRoles === "admins_only"
      ? ["super_admin", "admin"]
      : targetRoles === "teachers_only"
      ? ["teacher"]
      : ["super_admin", "admin", "teacher", "staff"];

  const handleSend = async () => {
    if (!subject.trim() || !title.trim() || !message.trim()) {
      toast.error(lang === "en" ? "Please fill in Subject, Title and Message." : "እባክዎ ርዕሰ ጉዳይ፣ ርዕስ እና መልዕክት ይሙሉ።");
      return;
    }
    if (filteredRecipients.length === 0) {
      toast.error(lang === "en" ? "No recipients match the selected audience." : "ምንም ተቀባይ ለተመረጠው ታዳሚ አልተገኘም።");
      return;
    }

    setSending(true);
    setLastResult(null);

    try {
      const res = await fetch("/api/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          title: title.trim(),
          message: message.trim(),
          announcementType,
          actionUrl: actionUrl.trim() || undefined,
          actionLabel: actionLabel.trim() || undefined,
          targetRoles: resolvedRoles,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(data?.message || (lang === "en" ? "Broadcast failed." : "ስርጭቱ አልተሳካም።"));
        return;
      }

      setLastResult({
        sent: data.sent,
        failed: data.failed,
        total: data.totalRecipients,
        provider: data.provider,
      });

      const providerLabel = data.provider === "simulated" ? " (simulated — add API key to send real emails)" : ` via ${data.provider}`;
      toast.success(
        lang === "en"
          ? `✅ Broadcast sent to ${data.sent}/${data.totalRecipients} recipients${providerLabel}`
          : `✅ ለ${data.sent}/${data.totalRecipients} ተቀባዮች ተላከ`
      );

      // Clear form after success
      setSubject("");
      setTitle("");
      setMessage("");
      setActionUrl("");
      setActionLabel("");
    } catch {
      toast.error(lang === "en" ? "Network error. Please try again." : "የኔትዎርክ ስህተት። እንደገና ይሞክሩ።");
    } finally {
      setSending(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <Megaphone className="h-12 w-12 text-slate-300" />
        <h3 className="mt-4 text-base font-bold text-slate-700">
          {lang === "en" ? "Super Admins Only" : "ሱፐር አድሚኖች ብቻ"}
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          {lang === "en"
            ? "Only super administrators can send announcements."
            : "ማስታወቂያዎችን መላክ የሚችሉት ሱፐር አድሚኖች ብቻ ናቸው።"}
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={lang === "en" ? "Announcements & Broadcast" : "ማስታወቂያዎች እና ብሮድካስት"}
        subtitle={
          lang === "en"
            ? "Send feature updates, platform notices and team announcements to all registered admins and staff."
            : "ለሁሉም ምዝገባ ያደረጉ አድሚኖች እና ሰራተኞች ሁሉ ባህሪ ዝማኔዎችን፣ ማስታወቂያዎችን ይላኩ።"
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Compose Panel */}
        <div className="space-y-5">
          {/* Announcement Type + Audience */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                {lang === "en" ? "Announcement Type" : "የማስታወቂያ አይነት"}
              </label>
              <Select value={announcementType} onChange={(e) => setAnnouncementType(e.target.value)}>
                {ANNOUNCEMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {lang === "en" ? t.label : t.labelAm}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                {lang === "en" ? "Send To" : "ለ"}
              </label>
              <Select value={targetRoles} onChange={(e) => setTargetRoles(e.target.value)}>
                {TARGET_ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {lang === "en" ? opt.label : opt.labelAm}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              {lang === "en" ? "Email Subject" : "የኢሜይል ርዕሰ ጉዳይ"}
            </label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={
                lang === "en"
                  ? "e.g. New Media Gallery — Phase 2 Update"
                  : "ለምሳሌ: አዲስ ሚዲያ ጋለሪ — ሁለተኛ ምዕራፍ ዝማኔ"
              }
            />
          </div>

          {/* Announcement Title */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              {lang === "en" ? "Announcement Title (headline in email)" : "የማስታወቂያ ርዕስ (ኢሜይሉ ውስጥ)"}
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                lang === "en"
                  ? "e.g. 🎉 The new photo gallery is live!"
                  : "ለምሳሌ: 🎉 አዲሱ ጋለሪ ዝግጁ ነው!"
              }
            />
          </div>

          {/* Message body */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              {lang === "en" ? "Message" : "መልዕክት"}
              <span className="ml-2 text-xs font-normal text-slate-400">
                {lang === "en" ? "(separate paragraphs with a blank line)" : "(አንቀጾቹን ባዶ መስመር ይለዩ)"}
              </span>
            </label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              placeholder={
                lang === "en"
                  ? "Write the announcement body here. You can use blank lines to separate paragraphs...\n\nExample: We have deployed a new dedicated photo gallery grid and video showcase section to the public website. Photos and videos are now managed fully from the Media & Gallery dashboard."
                  : "የማስታወቂያውን ይዘት እዚህ ይፃፉ..."
              }
            />
          </div>

          {/* Optional CTA */}
          <details className="group rounded-xl border border-slate-200 bg-slate-50/60">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-700">
              <Zap className="h-4 w-4 text-amber-500" />
              {lang === "en" ? "Custom Action Button (optional)" : "ብጁ የድርጊት አዝራር (አማራጭ)"}
            </summary>
            <div className="grid gap-4 px-4 pb-4 pt-2 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  {lang === "en" ? "Button URL" : "የአዝራር አድራሻ"}
                </label>
                <Input
                  value={actionUrl}
                  onChange={(e) => setActionUrl(e.target.value)}
                  placeholder="https://..."
                  className="font-mono text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  {lang === "en" ? "Button Label" : "የአዝራር ጽሁፍ"}
                </label>
                <Input
                  value={actionLabel}
                  onChange={(e) => setActionLabel(e.target.value)}
                  placeholder={lang === "en" ? "View in Dashboard →" : "ዳሽቦርድ ውስጥ ይምልከቱ →"}
                />
              </div>
            </div>
          </details>

          {/* Send Button */}
          <div className="flex items-center gap-4">
            <Button
              onClick={handleSend}
              disabled={sending || !subject.trim() || !title.trim() || !message.trim()}
              className="h-11 gap-2 px-6 text-sm font-bold shadow-lg shadow-royal-700/20 disabled:opacity-50"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {sending
                ? (lang === "en" ? "Sending…" : "በመላክ ላይ…")
                : (lang === "en"
                    ? `Send to ${filteredRecipients.length} recipient${filteredRecipients.length !== 1 ? "s" : ""}`
                    : `ለ${filteredRecipients.length} ሰዎች ላክ`)}
            </Button>
            {!subject.trim() || !title.trim() || !message.trim() ? (
              <p className="text-xs text-slate-400">
                {lang === "en" ? "Fill in all required fields to send." : "ለመላክ ሁሉንም አስፈላጊ መስኮች ይሙሉ።"}
              </p>
            ) : null}
          </div>

          {/* Result Banner */}
          {lastResult && (
            <div
              className={`flex items-start gap-3 rounded-xl border p-4 ${
                lastResult.failed === 0
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-amber-200 bg-amber-50"
              }`}
            >
              <CheckCircle2
                className={`mt-0.5 h-5 w-5 shrink-0 ${
                  lastResult.failed === 0 ? "text-emerald-600" : "text-amber-600"
                }`}
              />
              <div>
                <p className={`font-bold ${lastResult.failed === 0 ? "text-emerald-900" : "text-amber-900"}`}>
                  {lang === "en"
                    ? `Broadcast complete — ${lastResult.sent}/${lastResult.total} sent`
                    : `ስርጭት ተጠናቀቀ — ${lastResult.sent}/${lastResult.total} ተላከ`}
                </p>
                {lastResult.failed > 0 && (
                  <p className="mt-0.5 text-xs text-amber-700">
                    {lastResult.failed} {lang === "en" ? "delivery failure(s)" : "ያልተላኩ"}
                  </p>
                )}
                <p className="mt-1 text-xs text-slate-500">
                  {lang === "en" ? "Provider:" : "አቅራቢ:"} {lastResult.provider}
                  {lastResult.provider === "simulated" && (
                    <span className="ml-1 text-amber-600">
                      — {lang === "en" ? "Add RESEND_API_KEY in .env.local to send real emails" : "RESEND_API_KEY ይጨምሩ"}
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Recipients Sidebar */}
        <div className="space-y-4">
          {/* Recipient Preview */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
            <div
              className="flex cursor-pointer items-center justify-between border-b border-slate-100 px-4 py-3.5"
              onClick={() => setShowRecipients(!showRecipients)}
            >
              <div className="flex items-center gap-2.5">
                <Users className="h-4 w-4 text-royal-600" />
                <span className="text-sm font-bold text-slate-800">
                  {lang === "en" ? "Recipients" : "ተቀባዮች"}
                </span>
                <span className="inline-flex items-center justify-center rounded-full bg-royal-600 px-2 py-0.5 text-[11px] font-bold text-white">
                  {filteredRecipients.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); loadRecipients(); }}
                  className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  title={lang === "en" ? "Refresh" : "አድስ"}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingRecipients ? "animate-spin" : ""}`} />
                </button>
                {showRecipients ? (
                  <ChevronUp className="h-4 w-4 text-slate-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                )}
              </div>
            </div>

            {showRecipients && (
              <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
                {loadingRecipients ? (
                  <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {lang === "en" ? "Loading recipients…" : "ተቀባዮችን በመጫን ላይ…"}
                  </div>
                ) : filteredRecipients.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    {lang === "en" ? "No recipients for selected audience." : "ምንም ተቀባዮች የሉም።"}
                  </div>
                ) : (
                  filteredRecipients.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-royal-50 text-xs font-bold text-royal-700">
                        {(r.first_name?.[0] ?? r.email[0]).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-slate-900">
                          {[r.first_name, r.last_name].filter(Boolean).join(" ") || r.email}
                        </p>
                        <p className="truncate text-[11px] text-slate-400">{r.email}</p>
                      </div>
                      <Badge tone={roleBadgeProps(r.role).tone}>
                        {formatRole(r.role)}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            )}

            {!showRecipients && (
              <div className="px-4 py-3 text-xs text-slate-400">
                {loadingRecipients
                  ? (lang === "en" ? "Loading…" : "በመጫን ላይ…")
                  : lang === "en"
                  ? `${filteredRecipients.length} people will receive this broadcast. Click to preview.`
                  : `${filteredRecipients.length} ሰዎች ይቀበሉ። ለቅድመ እይታ ጠቅ ያድርጉ።`}
              </div>
            )}
          </div>

          {/* Email Provider Status */}
          <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <Mail className="h-4 w-4 text-royal-600" />
              {lang === "en" ? "Email Provider" : "የኢሜይል አቅራቢ"}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {lang === "en"
                ? "Configure your email provider by adding a key to .env.local:"
                : "ቁልፉን ወደ .env.local ጨምሩ:"}
            </p>
            <div className="mt-2 space-y-1.5">
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="font-mono text-[11px] text-slate-600">RESEND_API_KEY=re_...</p>
                <p className="text-[10px] text-slate-400">resend.com · Free tier available</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="font-mono text-[11px] text-slate-600">SENDGRID_API_KEY=SG....</p>
                <p className="text-[10px] text-slate-400">sendgrid.com · Fallback option</p>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              {lang === "en"
                ? "Without a key, emails are simulated and shown in server logs."
                : "ቁልፍ ሳይኖር ኢሜይሎች ሲምዩሌት ይደረጋሉ።"}
            </p>
          </div>

          {/* Tips */}
          <div className="rounded-2xl border border-royal-100/70 bg-royal-50/50 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-royal-800">
              <Bell className="h-4 w-4" />
              {lang === "en" ? "Broadcast Tips" : "የብሮድካስት ጠቃሚ ምክሮች"}
            </div>
            <ul className="mt-2 space-y-1.5 text-xs text-royal-700">
              <li>• {lang === "en" ? "Each recipient gets a personalized email with their name." : "እያንዳንዱ ተቀባይ በስማቸው የተለየ ኢሜይል ያገኛሉ።"}</li>
              <li>• {lang === "en" ? "Use the audience selector to target specific roles." : "ለተወሰኑ ሚናዎች የታዳሚ ምርጫ ይጠቀሙ።"}</li>
              <li>• {lang === "en" ? "Blank lines in Message create separate paragraphs." : "ባዶ መስመሮች ሰነዱ ውስጥ ፓራግራፎች ይፈጥራሉ።"}</li>
              <li>• {lang === "en" ? "Custom button links recipients to a specific section." : "ብጁ አዝራሮች ተቀባዮችን ወደ ተወሰነ ቦታ ይወስዳሉ።"}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
