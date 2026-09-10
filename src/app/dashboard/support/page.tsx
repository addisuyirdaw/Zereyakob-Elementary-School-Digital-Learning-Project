"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Banknote,
  HeartHandshake,
  Inbox,
  Mail,
  Rocket,
} from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { useDashboard } from "@/lib/dashboard-context";
import { createClient } from "@/lib/supabase/client";
import { ContactForm } from "@/components/contact-form";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { formatDate } from "@/lib/utils";
import type { Database } from "@/types/database";

type Message = Database["public"]["Tables"]["messages"]["Row"];

export default function SupportPage() {
  const { t, lang } = useLang();
  const { isStaff } = useDashboard();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loaded, setLoaded] = useState(false);

  const loadMessages = useCallback(async () => {
    if (!isStaff) return;
    const supabase = createClient();
    if (!supabase) {
      setLoaded(true);
      return;
    }
    const { data } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setMessages(data ?? []);
    setLoaded(true);
  }, [isStaff]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const markRead = async (message: Message) => {
    if (message.is_read) return;
    const supabase = createClient();
    if (!supabase) return;
    const { error } = await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("id", message.id);
    if (!error) loadMessages();
  };

  const unread = messages.filter((m) => !m.is_read).length;

  return (
    <div>
      <PageHeader title={t("sup.title")} subtitle={t("sup.subtitle")} />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Funding portal */}
        <Card>
          <CardContent className="px-6 py-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-royal-700 text-white shadow-glow">
              <Banknote className="h-5 w-5" aria-hidden />
            </span>
            <CardTitle className="mt-4">{t("sup.funding.title")}</CardTitle>
            <CardDescription>{t("sup.funding.desc")}</CardDescription>

            <div className="mt-6 space-y-3">
              {[
                {
                  key: "classrooms",
                  en: "Classroom materials & furniture",
                  am: "የመማሪያ ክፍል ቁሳቁሶች እና የቤት እቃዎች",
                  value: () =>
                    lang === "en"
                      ? "Tables, chairs, boards and books for 15 learners."
                      : "ለ15 ተማሪዎች ጠረጴዛ፣ ወንበር፣ ሰሌዳ እና መጽሐፍት።",
                },
                {
                  key: "tech",
                  en: "Learning technology",
                  am: "የትምህርት ቴክኖሎጂ",
                  value: () =>
                    lang === "en"
                      ? "Tablets and connectivity for digital lessons, guided by Debre Berhan University."
                      : "በደብረ ብርሃን ዩኒቨርሲቲ የሚመራ ለዲጂታል ትምህርት ታብሌቶች እና ኔትወርክ።",
                },
                {
                  key: "meals",
                  en: "Daily school meals",
                  am: "የዕለት ትምህርት ቤት ምግብ",
                  value: () =>
                    lang === "en"
                      ? "A nutritious meal each school day keeps energy up and minds open."
                      : "በእያንዳንዱ የትምህርት ቀን የተመጣጠነ ምግብ ኃይልን ይጨምራል፣ አእምሮን ይከፍታል።",
                },
              ].map((item) => (
                <div key={item.key} className="rounded-xl border border-slate-200/60 bg-slate-50/60 px-4 py-3">
                  <p className="text-sm font-bold text-slate-800">
                    {lang === "en" ? item.en : item.am}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{item.value()}</p>
                </div>
              ))}
            </div>

            <a
              href="mailto:support@zereyakob.edu.et?subject=Funding%20partnership"
              className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-royal-700 text-sm font-semibold text-white shadow-lg shadow-royal-700/25 transition hover:bg-royal-600"
            >
              <Rocket className="h-4 w-4" aria-hidden />
              {t("sup.funding.cta")}
            </a>
            <p className="mt-3 text-center text-xs text-slate-400">
              {lang === "en"
                ? "Debre Berhan University verifies and co-supervises all funds."
                : "ደብረ ብርሃን ዩኒቨርሲቲ ሁሉንም ገንዘቦች ያረጋግጣል እና በጋራ ይቆጣጠራል።"}
            </p>
          </CardContent>
        </Card>

        {/* Contact form */}
        <Card>
          <CardContent className="px-6 py-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-royal-50 text-royal-700">
              <Mail className="h-5 w-5" aria-hidden />
            </span>
            <CardTitle className="mt-4">{t("sup.contact.title")}</CardTitle>
            <CardDescription>{t("sup.contact.desc")}</CardDescription>
            <div className="mt-5">
              <ContactForm compact />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inbox */}
      {isStaff && (
        <div className="mt-6">
          <div className="mb-4 flex items-center gap-2">
            <Inbox className="h-5 w-5 text-royal-700" aria-hidden />
            <h2 className="text-lg font-extrabold text-slate-900">{t("sup.inbox")}</h2>
            {unread > 0 && (
              <span className="rounded-full bg-royal-700 px-2 py-0.5 text-xs font-bold text-white">
                {unread}
              </span>
            )}
          </div>
          {!loaded ? (
            <p className="py-10 text-center text-sm text-slate-400">{t("common.loading")}</p>
          ) : messages.length === 0 ? (
            <Card className="p-8 text-center text-sm text-slate-400">{t("common.noData")}</Card>
          ) : (
            <div className="space-y-3">
              {messages.map((message) => (
                <button
                  key={message.id}
                  onClick={() => markRead(message)}
                  className="w-full rounded-2xl border border-slate-200/60 bg-white/90 p-5 text-left shadow-lg shadow-slate-900/5 transition hover:border-royal-300"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-royal-100 text-xs font-bold text-royal-800">
                      {message.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="font-bold text-slate-900">{message.name}</span>
                    <span className="text-xs text-slate-400">{message.email}</span>
                    {message.country && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                        {message.country}
                      </span>
                    )}
                    {!message.is_read && (
                      <span className="ml-auto h-2 w-2 rounded-full bg-royal-600" title={t("common.select")} />
                    )}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-800">{message.subject}</p>
                  <p className="mt-1 text-sm text-slate-500">{message.message}</p>
                  <p className="mt-2 text-xs text-slate-400">
                    {formatDate(message.created_at.split("T")[0], lang)} · {t(`sup.role.${message.role}`)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}